import { and, asc, desc, eq, gte, inArray, isNull, min, sql, sum } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";
import type { Db, DbOrTx } from "@/db";
import { agentRuns, checkups, contacts, leads, prospects, touches } from "@/db/schema";
import { FUNNEL_TARGETS } from "./market-selection/criteria";
import { type FunnelCounts, diagnose } from "./market-selection/funnel";
import type { Actor } from "./actor";
import { notFound } from "./errors";
import { researchedPage } from "./company-page-doc";
import { createPage, pageUrl } from "./company-pages";
import { audit, emit } from "./events";
import { loadResearch } from "./hubs";
import { cancelOpen, getSwitches, planTouches, planWarmCall, reachOf } from "./outreach";
import { LEGAL_BASES, LINKEDIN_DAILY, channelCheck } from "./outreach-rules";

/*
 * CRM (doc 15 §6ب گام ۴). One row per company, whether the company agent found it (outbound) or it came to us
 * through a hub or the check-up (inbound). Stages only move forward; each stage keeps its own timestamp so the
 * funnel counts every step a company passed, and the diagnostic funnel (market selection §2.6 ز) names the
 * first broken step.
 */

export const STAGES = ["new", "contacted", "replied", "interested", "meeting", "won", "lost", "do_not_contact"] as const;
export type Stage = (typeof STAGES)[number];
const RANK: Record<string, number> = { new: 0, contacted: 1, replied: 2, interested: 3, meeting: 4, won: 5 };
const STAMP = { contacted: "contactedAt", replied: "repliedAt", interested: "interestedAt", meeting: "meetingAt", won: "wonAt", lost: "lostAt" } as const;
export const OUTBOUND_SOURCES = ["maps", "import"];

const FREE_MAIL = /@(gmail|googlemail|libero|hotmail|outlook|live|yahoo|icloud|me|virgilio|alice|tiscali|tim|fastwebnet|email|gmx|web|t-online)\./i;

/** Same firm, same key: website host first, else name + city. */
export function prospectKey(i: { website?: string | null; name: string; city?: string | null }) {
  const host = i.website?.trim() ? (() => {
    try {
      return new URL(i.website!.includes("://") ? i.website! : `https://${i.website}`).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return null;
    }
  })() : null;
  return host ?? `${i.name}|${i.city ?? ""}`.toLowerCase().normalize("NFKD").replace(/[^\w|]+/g, "-");
}

export const prospectInput = z.object({
  name: z.string().min(2).max(200),
  website: z.string().max(300).optional(),
  phone: z.string().max(40).optional(),
  industry: z.string().regex(/^[a-z0-9-]+$/).max(60),
  country: z.string().length(2).transform((c) => c.toUpperCase()),
  region: z.string().max(80).optional(),
  city: z.string().max(80).optional(),
  nace: z.string().max(20).optional(),
  staff: z.number().int().positive().optional(),
  source: z.enum(["maps", "import"]),
  signals: z.record(z.string(), z.unknown()).default({}),
  score: z.number().optional(),
  criterionScores: z.record(z.string(), z.number()).optional(),
  contacts: z
    .array(
      z.object({
        name: z.string().max(120).optional(),
        role: z.string().max(120).optional(),
        email: z.email().max(200).optional(),
        phone: z.string().max(40).optional(),
        linkedinUrl: z.url().max(300).optional(),
        source: z.enum(["website", "apollo", "manual", "maps", "list"]),
        legalBasis: z.enum(LEGAL_BASES).optional(),
        basisSource: z.string().max(200).optional(),
      }),
    )
    .max(5)
    .default([]),
  // the agent's personal opening line, in the country language and in Persian for review
  personal: z.object({ local: z.string().max(400), fa: z.string().max(400) }).optional(),
  // facts with sources and the starter persona, from the company-research agent; template when missing
  page: researchedPage.optional(),
  // what finding and writing this company cost (Apify results, Claude tokens), for the cost of a customer
  cost: z.object({ eur: z.number().min(0).max(50), meta: z.record(z.string(), z.unknown()).default({}) }).optional(),
});

export type PlanEnv = { appUrl: string; sender: string; brand: string };

// Who signs the messages and where links point. SALES_SENDER is the person who sends LinkedIn notes and calls.
export const planEnv = (env = process.env): PlanEnv => ({
  appUrl: (env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  sender: env.SALES_SENDER ?? "Javad",
  brand: env.SITE_NAME ?? "Legend Partner",
});

/** The next deadline from the hub research, as one sentence for follow-ups. */
export function nextDeadline(industry: string, country: string, lang: string, now = new Date()) {
  const r = loadResearch().find((x) => x.industry === industry && x.country === country);
  const today = now.toISOString().slice(0, 10);
  const d = r?.deadlines.filter((x) => x.date && x.date >= today).sort((a, b) => a.date!.localeCompare(b.date!))[0];
  if (!d) return "";
  const t = d.title as Record<string, string>;
  return `${d.date}: ${t[lang] ?? t.en}`;
}

/** Company agent → CRM. Scraped emails are dropped where the country needs consent (data minimisation). */
export async function addProspect(db: Db, actor: Actor & { apiKeyId?: string }, raw: unknown, env: PlanEnv, now = new Date()) {
  const input = prospectInput.parse(raw);
  const key = prospectKey(input);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(prospects)
      .values({
        name: input.name, key, website: input.website, phone: input.phone, industry: input.industry, country: input.country, region: input.region,
        city: input.city, nace: input.nace, staff: input.staff, source: input.source, signals: input.signals,
        score: input.score?.toString(), criterionScores: input.criterionScores,
      })
      .onConflictDoNothing()
      .returning();
    if (input.cost) {
      await tx.insert(agentRuns).values({ agent: actor.id, apiKeyId: actor.apiKeyId, action: "prospect.add", costEur: input.cost.eur.toFixed(4), meta: { ...input.cost.meta, duplicate: !row } });
    }
    if (!row) return { id: null, duplicate: true, touches: 0 };
    const list = input.contacts.length
      ? await tx
          .insert(contacts)
          // a legal basis only comes with Javad's own imported lists, never from an agent's guess
          .values(input.contacts.map((c) => ({ ...c, prospectId: row.id, legalBasis: input.source === "import" ? c.legalBasis : null, basisSource: input.source === "import" ? c.basisSource : null, emailConsent: input.source === "import" && c.legalBasis === "consent" })))
          .returning()
      : [];
    const lang = input.country === "IT" ? "it" : "en";
    const page = await createPage(tx, row, `${lang}-${input.country.toLowerCase()}`, input.page, now);
    const planned = await planTouches(tx, row, list, {
      sequence: "cold", ...env, deadline: nextDeadline(input.industry, input.country, lang, now), personal: input.personal, now,
      pageUrl: page ? pageUrl(env.appUrl, page) : undefined,
    });
    const facts = { industry: input.industry, country: input.country, source: input.source, score: input.score ?? null };
    await emit(tx, actor, "prospect.added", { type: "prospect", id: row.id }, facts);
    await audit(tx, actor, "prospect.added", { type: "prospect", id: row.id }, null, facts);
    return { id: row.id, duplicate: false, touches: planned.filter((t) => t.status !== "skipped").length };
  });
}

/**
 * Inbound: a check-up unlock (consented email) or a call request becomes a CRM company with the warm or
 * callback sequence. Runs inside the check-up's own transaction.
 */
export async function prospectFromCheckup(tx: DbOrTx, actor: Actor, checkupId: string, env: PlanEnv, callback = false, phone?: string, now = new Date()) {
  const [c] = await tx.select().from(checkups).where(eq(checkups.id, checkupId));
  if (!c?.leadId) return null;
  const [lead] = await tx.select().from(leads).where(eq(leads.id, c.leadId));
  const domain = lead.email.split("@")[1] ?? "";
  const name = FREE_MAIL.test(lead.email) ? lead.email : domain;
  const key = `lead:${lead.id}`;
  let [p] = await tx.select().from(prospects).where(and(eq(prospects.country, c.country), eq(prospects.key, key)));
  if (!p) {
    [p] = await tx
      .insert(prospects)
      .values({ name, key, website: FREE_MAIL.test(lead.email) ? null : domain, industry: c.industry, country: c.country, source: "checkup", leadId: lead.id, checkupId: c.id, signals: { checkupTotalEur: c.totalEur } })
      .returning();
    await tx.insert(contacts).values({ prospectId: p.id, email: lead.email, emailConsent: true, source: "lead" });
    await emit(tx, actor, "prospect.added", { type: "prospect", id: p.id }, { industry: c.industry, country: c.country, source: "checkup" });
  }
  if (phone) await tx.update(contacts).set({ phone }).where(and(eq(contacts.prospectId, p.id), eq(contacts.source, "lead")));
  if (callback) await cancelOpen(tx, p.id, "call requested");
  else if (p.sequence) return p.id;
  await moveStage(tx, actor, p.id, "interested", now, callback ? "check-up: call requested" : "check-up unlocked");
  const [fresh] = await tx.select().from(prospects).where(eq(prospects.id, p.id));
  const list = await tx.select().from(contacts).where(eq(contacts.prospectId, p.id));
  const lang = c.locale.slice(0, 2);
  // A call the visitor asked for is a task for a person: no approval needed. Emails wait for Javad's approval.
  await planTouches(tx, fresh, list, { sequence: callback ? "callback" : "warm", ...env, deadline: nextDeadline(c.industry, c.country, lang, now), approved: callback ? "calls" : false, now });
  return p.id;
}

/** Moves a company forward (never back), stamps every step it passed, and stops the sequence once it answers. */
export async function moveStage(tx: DbOrTx, actor: Actor, id: string, stage: string, now: Date, why: string) {
  const [p] = await tx.select().from(prospects).where(eq(prospects.id, id)).for("update");
  if (!p) throw notFound("company");
  if (p.stage === "do_not_contact" || p.stage === stage) return p.stage;
  const terminal = stage === "lost" || stage === "do_not_contact";
  if (!terminal && (RANK[stage] ?? -1) <= (RANK[p.stage] ?? 99)) return p.stage;
  const set: Partial<typeof prospects.$inferInsert> = { stage, doNotContactReason: stage === "do_not_contact" ? why : p.doNotContactReason };
  for (const [s, col] of Object.entries(STAMP)) {
    const reached = terminal ? s === stage : RANK[s] !== undefined && RANK[s] <= RANK[stage];
    if (reached && !p[col]) set[col] = now;
  }
  await tx.update(prospects).set(set).where(eq(prospects.id, id));
  if (terminal || RANK[stage] >= RANK.replied) await cancelOpen(tx, id, `stopped: ${stage}`);
  // they answered on LinkedIn or email: a person may call at once (only when Javad switched warm calls on)
  if (stage === "replied" && p.source !== "checkup") await planWarmCall(tx, id, now);
  await emit(tx, actor, "prospect.stage_changed", { type: "prospect", id }, { from: p.stage, to: stage, why, industry: p.industry });
  await audit(tx, actor, "prospect.stage_changed", { type: "prospect", id }, { stage: p.stage }, { stage, why });
  return stage;
}

export async function setStage(db: Db, actor: Actor, id: string, stage: string, note?: string) {
  const s = z.enum(STAGES).parse(stage);
  return db.transaction((tx) => moveStage(tx, actor, id, s, new Date(), note || "set by hand"));
}

export async function unsubscribeLead(tx: DbOrTx, prospectId: string) {
  const [p] = await tx.select({ leadId: prospects.leadId }).from(prospects).where(eq(prospects.id, prospectId));
  if (p?.leadId) await tx.update(leads).set({ unsubscribedAt: new Date() }).where(and(eq(leads.id, p.leadId), isNull(leads.unsubscribedAt)));
}

/** Javad records why we may contact this person (needed for cold email and AI calls). */
export async function setLegalBasis(db: Db, actor: Actor, contactId: string, basis: string | null, source: string | null) {
  const b = basis ? z.enum(LEGAL_BASES).parse(basis) : null;
  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(contacts).where(eq(contacts.id, contactId));
    if (!c) throw notFound("contact");
    await tx.update(contacts).set({ legalBasis: b, basisSource: source?.slice(0, 200) || null }).where(eq(contacts.id, contactId));
    await audit(tx, actor, "contact.legal_basis", { type: "contact", id: contactId }, { basis: c.legalBasis, source: c.basisSource }, { basis: b, source });
  });
}

/** Records the Registro Pubblico delle Opposizioni result for the company's number (Italy). */
export async function setRpo(db: Db, actor: Actor, id: string, listed: boolean, now = new Date()) {
  return db.transaction(async (tx) => {
    await tx.update(prospects).set({ rpoCheckedAt: now, rpoListed: listed }).where(eq(prospects.id, id));
    if (listed) {
      await tx
        .update(touches)
        .set({ status: "skipped", blockedReason: "number is in the Registro delle Opposizioni" })
        .where(and(eq(touches.prospectId, id), eq(touches.channel, "phone"), inArray(touches.status, ["draft", "approved"])));
    }
    await audit(tx, actor, "prospect.rpo_checked", { type: "prospect", id }, null, { listed });
  });
}

/* ───────────── signal priority (research 2026-10-23: fit × signal × recency) ───────────── */

/**
 * Who to work first. fit and need come from the company agent's scores (0–10); recency from the newest dated
 * signal (`signals.seenAt`, ISO date), else when we found the firm. Tier 1 is acted on within 48 hours.
 */
type Scorable = { criterionScores: Record<string, number> | null; signals: Record<string, unknown>; createdAt: Date; source: string; industry: string; region: string | null; staff: number | null };

const SIGNAL_KEYS = ["hiringRepetitiveRoles", "affectedByObligation", "slowServiceReviews", "growing", "outdatedWebsite", "noOnlineBookingOrForms", "oldTechStack", "newManager"];
function features(p: Omit<Scorable, "criterionScores" | "createdAt" | "source">) {
  const f = new Set([`i:${p.industry}`]);
  if (p.region) f.add(`r:${p.region}`);
  if (p.staff) f.add(`s:${p.staff < 20 ? "s" : p.staff < 50 ? "m" : "l"}`);
  if (typeof p.signals.category === "string") f.add(`c:${p.signals.category}`);
  for (const k of SIGNAL_KEYS) {
    const v = p.signals[k];
    if (Array.isArray(v) ? v.length : v) f.add(`g:${k}`);
  }
  return f;
}

/** Lookalike (research 2026-10-23): how close a company is to the ones that already bought (0–1, Jaccard). */
export function lookalike(p: Omit<Scorable, "criterionScores" | "createdAt" | "source">, won: Omit<Scorable, "criterionScores" | "createdAt" | "source">[]) {
  const a = features(p);
  let best = 0;
  for (const w of won) {
    const b = features(w);
    const inter = [...a].filter((x) => b.has(x)).length;
    best = Math.max(best, inter / (a.size + b.size - inter));
  }
  return Math.round(best * 100) / 100;
}

export function priority(p: Scorable, now = new Date(), won: Scorable[] = []) {
  if (p.source !== "maps" && p.source !== "import") return { score: 1, tier: 1 as const };
  const fit = (p.criterionScores?.fit ?? 5) / 10;
  const need = Math.max(0.1, (p.criterionScores?.need ?? 0) / 10);
  const seen = typeof p.signals.seenAt === "string" ? new Date(p.signals.seenAt) : p.createdAt;
  const days = (now.getTime() - seen.getTime()) / 864e5;
  const recency = days <= 7 ? 1 : days <= 30 ? 0.7 : 0.4;
  // a page visit is the freshest intent there is; firms like our buyers rank higher
  const intent = typeof p.signals.pageViews === "number" && p.signals.pageViews > 0 ? 1.5 : 1;
  const score = Math.round(fit * need * recency * intent * (1 + 0.5 * lookalike(p, won)) * 100) / 100;
  return { score, tier: (score >= 0.35 ? 1 : score >= 0.12 ? 2 : 3) as 1 | 2 | 3 };
}

/* ───────────── reading ───────────── */

export async function listProspects(db: Db, filter: { stage?: string; industry?: string } = {}) {
  const where = and(filter.stage ? eq(prospects.stage, filter.stage) : undefined, filter.industry ? eq(prospects.industry, filter.industry) : undefined);
  const rows = await db.select().from(prospects).where(where).orderBy(desc(prospects.updatedAt)).limit(300);
  const next = rows.length
    ? await db
        .select({ prospectId: touches.prospectId, dueAt: min(touches.dueAt) })
        .from(touches)
        .where(and(inArray(touches.prospectId, rows.map((r) => r.id)), inArray(touches.status, ["draft", "approved"])))
        .groupBy(touches.prospectId)
    : [];
  const due = new Map(next.map((n) => [n.prospectId, n.dueAt]));
  return rows.map((r) => ({ ...r, nextAt: due.get(r.id) ?? null }));
}

export async function prospectDetail(db: Db, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const [p] = await db.select().from(prospects).where(eq(prospects.id, id));
  if (!p) return null;
  const [cs, ts] = await Promise.all([
    db.select().from(contacts).where(eq(contacts.prospectId, id)),
    db.select().from(touches).where(eq(touches.prospectId, id)).orderBy(asc(touches.position), asc(touches.createdAt)),
  ]);
  return { prospect: p, contacts: cs, touches: ts };
}

/** Today's work: sequences to approve, LinkedIn and phone tasks due, emails waiting for the provider. */
export async function outreachQueue(db: Db, now = new Date()) {
  const rows = await db
    .select({ t: touches, p: prospects, c: contacts })
    .from(touches)
    .innerJoin(prospects, eq(prospects.id, touches.prospectId))
    .leftJoin(contacts, eq(contacts.id, touches.contactId))
    .where(inArray(touches.status, ["draft", "approved"]))
    .orderBy(asc(touches.dueAt))
    .limit(500);
  const cache = new Map<string, Awaited<ReturnType<typeof getSwitches>>>();
  const switchesOf = async (cc: string) => cache.get(cc) ?? cache.set(cc, await getSwitches(db, cc)).get(cc)!;
  const approvals = new Map<string, { p: typeof prospects.$inferSelect; touches: (typeof rows)[number][] }>();
  const tasks: ((typeof rows)[number] & { why: string | null })[] = [];
  const emails: (typeof rows)[number][] = [];
  for (const r of rows) {
    if (r.t.status === "draft") {
      const a = approvals.get(r.p.id) ?? { p: r.p, touches: [] };
      a.touches.push(r);
      approvals.set(r.p.id, a);
    } else if (r.t.dueAt <= now) {
      if (r.t.channel === "email") emails.push(r);
      else tasks.push({ ...r, why: r.t.channel === "phone" ? channelCheck("phone", reachOf(r.p, r.c ?? undefined, await switchesOf(r.p.country)), now) : null });
    }
  }
  // LinkedIn's limits: only show what can still be sent today.
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const doneToday = await db
    .select({ step: touches.step, n: sql<number>`count(*)::int` })
    .from(touches)
    .where(and(eq(touches.channel, "linkedin"), eq(touches.status, "done"), gte(touches.sentAt, today)))
    .groupBy(touches.step);
  const invitesLeft = LINKEDIN_DAILY.invites - doneToday.filter((d) => d.step === "li-connect").reduce((a, d) => a + d.n, 0);
  const messagesLeft = LINKEDIN_DAILY.messages - doneToday.filter((d) => d.step !== "li-connect").reduce((a, d) => a + d.n, 0);
  let inv = 0;
  let msg = 0;
  const capped = tasks.filter((t) => t.t.channel !== "linkedin" || (t.t.step === "li-connect" ? inv++ < invitesLeft : msg++ < messagesLeft));
  const won = await db.select().from(prospects).where(sql`${prospects.wonAt} is not null`).limit(200);
  const tierOf = (p: typeof prospects.$inferSelect) => priority(p, now, won).tier;
  return {
    approvals: [...approvals.values()].sort((a, b) => tierOf(a.p) - tierOf(b.p)),
    tasks: capped.sort((a, b) => tierOf(a.p) - tierOf(b.p) || a.t.dueAt.getTime() - b.t.dueAt.getTime()),
    emails,
    linkedin: { invitesLeft: Math.max(0, invitesLeft), messagesLeft: Math.max(0, messagesLeft), held: tasks.length - capped.length },
  };
}

/**
 * Per-channel KPI (research 2026-10-23): after 200 touches below the reply target a channel is flagged for
 * downgrade, so money and time move to what works.
 */
const REPLY_OUTCOMES = ["replied", "callback", "interested", "meeting"];
export async function channelStats(db: Db) {
  const rows = await db
    .select({
      channel: touches.channel,
      done: sql<number>`count(*) filter (where ${touches.status} in ('done', 'sent'))::int`,
      replies: sql<number>`count(*) filter (where ${touches.outcome} in ${REPLY_OUTCOMES})::int`,
    })
    .from(touches)
    .groupBy(touches.channel);
  return rows.map((r) => {
    const rate = r.done ? r.replies / r.done : null;
    return { ...r, rate, downgrade: r.done >= 200 && rate !== null && rate < FUNNEL_TARGETS.replyRate };
  });
}

/** Outbound funnel per industry with the diagnosis, plus cost per customer from the agents' runs. */
export async function crmFunnel(db: Db, now = new Date()) {
  const n = (col: AnyPgColumn) => sql<number>`count(${col})::int`;
  const rows = await db
    .select({
      industry: prospects.industry,
      companies: sql<number>`count(*)::int`,
      contacted: n(prospects.contactedAt),
      replied: n(prospects.repliedAt),
      interested: n(prospects.interestedAt),
      meetings: n(prospects.meetingAt),
      won: n(prospects.wonAt),
      start: min(prospects.createdAt),
    })
    .from(prospects)
    .where(inArray(prospects.source, OUTBOUND_SOURCES))
    .groupBy(prospects.industry);
  const inbound = await db
    .select({ industry: prospects.industry, companies: sql<number>`count(*)::int`, won: n(prospects.wonAt) })
    .from(prospects)
    .where(sql`${prospects.source} not in ('maps', 'import')`)
    .groupBy(prospects.industry);
  const [cost] = await db.select({ eur: sum(agentRuns.costEur) }).from(agentRuns).where(eq(agentRuns.action, "prospect.add")); // finding + writing, per company
  const costEur = Number(cost?.eur ?? 0);
  const wonAll = rows.reduce((s, r) => s + r.won, 0);
  return {
    costEur,
    cacEur: wonAll ? costEur / wonAll : null,
    inbound,
    outbound: rows.map((r) => {
      const counts: FunnelCounts = { ...r, daysSinceStart: r.start ? Math.floor((now.getTime() - r.start.getTime()) / 864e5) : 0 };
      return { ...r, diagnosis: diagnose(counts) };
    }),
  };
}

// Count of companies per stage, for the cockpit header.
export async function stageCounts(db: Db) {
  const rows = await db.select({ stage: prospects.stage, n: sql<number>`count(*)::int` }).from(prospects).groupBy(prospects.stage);
  return Object.fromEntries(rows.map((r) => [r.stage, r.n])) as Record<string, number>;
}

