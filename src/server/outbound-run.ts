import { ZodError } from "zod";
import type { Db } from "@/db";
import { type Imported, type RunSummary, runOutbound, type Target } from "@/agents/outbound";
import { researchCompany, researchEnabled } from "@/agents/company-research";
import { companySearchFromEnv } from "@/providers/company-search";
import { llm } from "@/providers/llm";
import { peopleSearchFromEnv } from "@/providers/people-search";
import type { AdminChat } from "@/providers/admin-chat";
import targetsFile from "../../data/outreach/targets.json";
import type { Actor } from "./actor";
import { agentStatus } from "./agents";
import { addProspect, planEnv } from "./crm";
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
