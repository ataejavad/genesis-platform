import { ZodError } from "zod";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { cleanName } from "@/agents/company-finder";
import { agentRuns, companyPages, contacts, prospects, touches } from "@/db/schema";
import { buildPageDoc, pageUrl } from "./company-pages";
import { planTouches } from "./outreach";
import { type Imported, type RunSummary, runOutbound, type Target } from "@/agents/outbound";
import { researchCompany, researchEnabled } from "@/agents/company-research";
import { companySearchFromEnv } from "@/providers/company-search";
import { llm } from "@/providers/llm";
import { peopleSearchFromEnv } from "@/providers/people-search";
import type { AdminChat } from "@/providers/admin-chat";
import targetsFile from "../../data/outreach/targets.json";
import type { Actor } from "./actor";
import { agentStatus } from "./agents";
import { addProspect, nextDeadline, planEnv } from "./crm";
import { AppError } from "./errors";
import { audit, emit } from "./events";
import { lessonsFor } from "./improve";
import { AGENT_BUDGETS } from "./market-selection/criteria";
import { pausedFilters } from "./market-filters";
import { isStopped } from "./switches";

/*
 * The outbound machine on the hosted server (Javad 2026-11-20: first real customer search). Same pipeline as
 * npm run agents:outbound, run from Cockpit › Outbound with the keys the server already has (Apify, Gemini,
 * Apollo). Every company lands in the CRM with its page and its sequence as drafts; nothing is sent until Javad
 * approves it in the cockpit. A run fits inside one request (Vercel: 300 s), so it is capped and time-boxed.
 */

export const TARGETS = (targetsFile as { targets: Target[] }).targets;
// one run from the cockpit: small enough for one request and for the free Apify credit (~€0.004 a result)
export const RUN_MAX = 15;

export type RunRequest = { industry: string; region?: string; limit: number };
export type RunDeps = { finder?: ReturnType<typeof companySearchFromEnv>; people?: ReturnType<typeof peopleSearchFromEnv>; research?: boolean; adminChat?: AdminChat | null; budgetMs?: number };

export async function findCustomers(db: Db, actor: Actor, req: RunRequest, deps: RunDeps = {}, imported?: Imported[]): Promise<RunSummary> {
  const target = TARGETS.find((t) => t.industry === req.industry);
  if (!target) throw new AppError(400, "invalid", `unknown market ${req.industry}`);
  if (req.region && !target.regions.includes(req.region)) throw new AppError(400, "invalid", `unknown region ${req.region}`);
  if (await isStopped(db)) throw new AppError(423, "stopped", "the emergency stop holds every agent");
  const limit = Math.max(1, Math.min(req.limit, RUN_MAX, AGENT_BUDGETS.company.maxCompaniesPerDay));
  const finder = deps.finder === undefined ? companySearchFromEnv() : deps.finder;
  if (!finder && !imported) throw new AppError(400, "invalid", "No company search set: add APIFY_TOKEN, then redeploy");
  const people = deps.people === undefined ? peopleSearchFromEnv() : deps.people;
  // research spends AI-model money: only while the agent is on and under its monthly budget (Cockpit › Agents)
  const gate = await agentStatus(db, "company-research");
  const research = (deps.research ?? researchEnabled()) && gate.allowed;
  const lessons = research ? (await lessonsFor(db, "outreach")).map((l) => l.text) : [];
  const env = planEnv();
  const started = Date.now();
  const summary = await runOutbound([target], {
    finder, people,
    research: research ? { lessons, run: researchCompany } : null,
    researchProvider: research ? llm().provider : undefined,
    paused: await pausedFilters(db),
    save: async (body) => {
      try {
        const r = await addProspect(db, actor, body, env);
        return { ok: true, duplicate: r.duplicate, touches: r.touches };
      } catch (err) {
        // one bad listing must not stop the run; zod names the field
        const m = err instanceof ZodError ? err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : err instanceof Error ? err.message : "failed";
        return { ok: false, error: m.slice(0, 200) };
      }
    },
  }, { limit, regions: req.region ? [req.region] : undefined, imported, deadline: started + (deps.budgetMs ?? 200_000), concurrency: 3 });

  const facts = { errors: summary.errors, industry: target.industry, country: target.country, region: req.region ?? null, found: summary.found, added: summary.added, duplicates: summary.duplicates, failed: summary.failed, researched: summary.researched, costEur: summary.costEur, ms: Date.now() - started };
  await db.transaction(async (tx) => {
    await emit(tx, actor, "outbound.run_finished", { type: "market", id: `${target.country}:${target.industry}` }, facts);
    await audit(tx, actor, "outbound.run_finished", { type: "market", id: `${target.country}:${target.industry}` }, null, facts);
  });
  // the founder's phone: one line per run, the approvals stay in the cockpit (one decision per company)
  const chat = deps.adminChat;
  if (chat && summary.added) {
    await chat
      .alert([`🔎 ${summary.added} شرکت تازه (${target.industry}، ${req.region ?? target.country}) با پیش‌نویس پیام منتظر تأیید توست.`, "هیچ پیامی بدون تأیید تو ارسال نمی‌شود."], `${env.appUrl}/cockpit/outreach`)
      .catch(() => null);
  }
  return summary;
}

/*
 * Research backlog (2026-11-20: the free Gemini quota ran out during the first runs). Companies saved without
 * research get it later: once a day after the quota resets, and from the cockpit. Only companies whose messages
 * are all still drafts are touched; their page and drafts are rebuilt with the researched facts and the personal
 * opening line. A 429 (quota) stops the batch; the rest waits for the next day.
 */
export async function researchBacklog(db: Db, actor: Actor, o: { max?: number; budgetMs?: number; run?: typeof researchCompany; adminChat?: AdminChat | null } = {}, now = new Date()) {
  const run = o.run ?? researchCompany;
  if (!o.run && !researchEnabled()) return { researched: 0, waiting: 0, stopped: "no AI model with web search connected" };
  const gate = await agentStatus(db, "company-research");
  if (!gate.allowed) return { researched: 0, waiting: 0, stopped: "company research is off or over its budget (Cockpit › Agents)" };
  const rows = await db
    .select()
    .from(prospects)
    .where(and(eq(prospects.source, "maps"), eq(prospects.stage, "new"), eq(prospects.sequence, "cold"), sql`coalesce(${prospects.signals}->>'researched', '') = ''`))
    .orderBy(desc(prospects.score))
    .limit(50);
  const open = rows.length
    ? await db.select({ prospectId: touches.prospectId }).from(touches).where(and(inArray(touches.prospectId, rows.map((r) => r.id)), eq(touches.status, "approved")))
    : [];
  const todo = rows.filter((r) => !open.some((t) => t.prospectId === r.id));
  const lessons = (await lessonsFor(db, "outreach")).map((l) => l.text);
  const env = planEnv();
  const started = Date.now();
  let researched = 0;
  let stopped: string | null = null;
  for (const p of todo.slice(0, o.max ?? 4)) {
    if (Date.now() - started > (o.budgetMs ?? 150_000)) break;
    let r: Awaited<ReturnType<typeof researchCompany>>;
    try {
      r = await run({ name: cleanName(p.name), website: p.website ?? undefined, city: p.city ?? undefined, industry: p.industry, country: p.country, signals: p.signals }, lessons);
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      if (/\b429\b|quota/i.test(m)) {
        stopped = m.slice(0, 300);
        break;
      }
      await db.update(prospects).set({ signals: { ...p.signals, researched: "failed", researchError: m.slice(0, 200) } }).where(eq(prospects.id, p.id));
      continue;
    }
    await db.transaction(async (tx) => {
      const name = cleanName(p.name);
      const [row] = await tx.update(prospects).set({ name, signals: { ...p.signals, researched: now.toISOString().slice(0, 10), ...(name !== p.name ? { listingName: p.name } : {}) } }).where(eq(prospects.id, p.id)).returning();
      const list = await tx.select().from(contacts).where(eq(contacts.prospectId, p.id));
      const lang = p.country === "IT" ? "it" : "en";
      const [page] = await tx.select().from(companyPages).where(eq(companyPages.prospectId, p.id));
      const doc = buildPageDoc(row, lang, page?.locale ?? `${lang}-${p.country.toLowerCase()}`, { facts: r.facts, persona: r.persona }, now);
      if (page && doc) await tx.update(companyPages).set({ doc }).where(eq(companyPages.id, page.id));
      // the drafts are rewritten with the personal line; nothing was approved yet, so nothing is lost
      await tx.delete(touches).where(and(eq(touches.prospectId, p.id), inArray(touches.status, ["draft", "skipped"])));
      await planTouches(tx, row, list, { sequence: "cold", ...env, deadline: nextDeadline(p.industry, p.country, lang, now), personal: r.personal, now, pageUrl: page ? pageUrl(env.appUrl, page) : undefined });
      await tx.insert(agentRuns).values({ agent: "company-research", action: "prospect.research", costEur: r.costEur.toFixed(4), meta: { prospect: p.id, backlog: true } });
      await audit(tx, actor, "prospect.researched", { type: "prospect", id: p.id }, { name: p.name }, { name, facts: r.facts.length });
    });
    researched++;
  }
  const waiting = todo.length - researched;
  // the founder hears the result on his phone, so nobody has to open the cockpit to know it ran
  if (o.adminChat && (researched || stopped)) {
    const lines = [
      researched ? `🔬 ${researched} شرکت تحقیق شد و پیش‌نویس پیام‌هایشان با جمله شخصی به‌روز شد.` : "🔬 تحقیق شرکت‌ها امروز انجام نشد.",
      waiting ? `${waiting} شرکت هنوز منتظر تحقیق است${stopped ? " (سهمیه رایگان AI تمام شد؛ فردا دوباره)" : ""}.` : "همه شرکت‌ها تحقیق دارند و منتظر تأیید تو هستند.",
    ];
    await o.adminChat.alert(lines, `${env.appUrl}/cockpit/outreach`).catch(() => null);
  }
  return { researched, waiting, stopped };
}

/** How many saved companies still wait for research (cockpit). */
export async function researchWaiting(db: Db) {
  const [r] = await db.select({ n: count() }).from(prospects).where(and(eq(prospects.source, "maps"), eq(prospects.stage, "new"), sql`coalesce(${prospects.signals}->>'researched', '') = ''`));
  return r?.n ?? 0;
}
