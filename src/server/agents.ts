import { and, countDistinct, eq, gte, lt, or, sql, sum } from "drizzle-orm";
import { costEur, metered } from "@/agents/meter";
import { AGENTS, type AgentDef, agentDef, type KpiId } from "@/config/agents";
import type { Db, DbOrTx } from "@/db";
import { agentRuns, agentSettings, checkups, inbox, leads, partners, portalMessages, portalThreads, prospects, qaReviews } from "@/db/schema";
import type { Actor } from "./actor";
import { AppError } from "./errors";
import { audit, emit } from "./events";

/*
 * Agents as employees (doc 15 §6ز, value filter): each Claude call goes through runAgent(), which checks the switch
 * and the monthly budget, then records tokens and € in agent_runs. The hourly budget check pauses an agent that
 * spent its budget until the 1st of next month. KPIs come from the company's own data, never from the agent.
 */

const DAY = 864e5;
const monthStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
const nextMonth = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
const round2 = (n: number) => Math.round(n * 100) / 100;

// Agents that ran before the registry recorded their cost under another name (outbound: action prospect.add).
const spendFilter = (id: string) => (id === "company-research" ? or(eq(agentRuns.agent, id), eq(agentRuns.action, "prospect.add")) : eq(agentRuns.agent, id));

export async function spentEur(db: DbOrTx, id: string, from: Date, to?: Date) {
  const [r] = await db.select({ eur: sum(agentRuns.costEur) }).from(agentRuns).where(and(spendFilter(id), gte(agentRuns.createdAt, from), to ? lt(agentRuns.createdAt, to) : undefined));
  return round2(Number(r?.eur ?? 0));
}

export async function agentStatus(db: DbOrTx, id: string, now = new Date()) {
  const def = agentDef(id);
  if (!def) throw new AppError(404, "not_found", `unknown agent ${id}`);
  const [s] = await db.select().from(agentSettings).where(eq(agentSettings.agent, id));
  const budgetEur = s?.budgetEur ?? def.budgetEur;
  const spent = await spentEur(db, id, monthStart(now));
  const paused = Boolean(s?.pausedUntil && s.pausedUntil > now);
  const enabled = s?.enabled ?? true;
  return { def, enabled, budgetEur, spentEur: spent, paused, pausedUntil: s?.pausedUntil ?? null, allowed: enabled && !paused && spent < budgetEur };
}

/** The one door for in-app Claude calls: switch + budget first, then the call, then tokens and € on record. */
export async function runAgent<T>(db: Db, id: string, action: string, fn: () => Promise<T>, meta: Record<string, unknown> = {}): Promise<T> {
  const st = await agentStatus(db, id);
  if (!st.allowed) throw new AppError(423, "agent_paused", `${id} is ${!st.enabled ? "switched off" : "over its monthly budget"}`);
  const started = Date.now();
  const usage = { input: 0, output: 0, searches: 0 };
  try {
    const r = await metered(fn, usage);
    await record(db, id, action, usage, true, { ...meta, ms: Date.now() - started });
    return r.result;
  } catch (err) {
    await record(db, id, action, usage, false, { ...meta, ms: Date.now() - started, error: err instanceof Error ? err.message.slice(0, 200) : "failed" }).catch(() => null);
    throw err;
  }
}

async function record(db: Db, id: string, action: string, u: { input: number; output: number; searches: number }, ok: boolean, meta: Record<string, unknown>) {
  await db.insert(agentRuns).values({ agent: id, action, inputTokens: u.input, outputTokens: u.output, costEur: costEur(u).toFixed(4), ok, meta: { ...meta, searches: u.searches } });
}

/** Scripts (hub builder, outbound) report their usage through the API; same table, same budget. */
export async function recordUsage(db: Db, id: string, action: string, u: { input: number; output: number; searches?: number }, meta: Record<string, unknown> = {}) {
  if (!agentDef(id)) throw new AppError(404, "not_found", `unknown agent ${id}`);
  await record(db, id, action, { input: u.input, output: u.output, searches: u.searches ?? 0 }, true, meta);
  return agentStatus(db, id);
}

/** Hourly: an agent over its budget rests until the 1st of next month (Javad can lift it in the cockpit). */
export async function checkBudgets(db: Db, now = new Date()) {
  const paused: string[] = [];
  for (const a of AGENTS) {
    const st = await agentStatus(db, a.id, now);
    if (st.paused || !st.enabled || st.spentEur < st.budgetEur) continue;
    await db.transaction(async (tx) => {
      await tx.insert(agentSettings).values({ agent: a.id, pausedUntil: nextMonth(now) }).onConflictDoUpdate({ target: agentSettings.agent, set: { pausedUntil: nextMonth(now) } });
      const actor: Actor = { type: "system", id: "budget" };
      await emit(tx, actor, "agent.paused", { type: "agent", id: a.id }, { agent: a.id, name: a.name, spentEur: st.spentEur, budgetEur: st.budgetEur, until: nextMonth(now).toISOString().slice(0, 10) });
      await audit(tx, actor, "agent.paused", { type: "agent", id: a.id }, null, { spentEur: st.spentEur, budgetEur: st.budgetEur });
    });
    paused.push(a.id);
  }
  return paused;
}

/** Javad's switch and budget for one agent; lifting a pause is part of it. */
export async function setAgent(db: Db, actor: Actor, id: string, v: { enabled?: boolean; budgetEur?: number | null; resume?: boolean }) {
  if (!agentDef(id)) throw new AppError(404, "not_found", `unknown agent ${id}`);
  const set = { ...(v.enabled !== undefined ? { enabled: v.enabled } : {}), ...(v.budgetEur !== undefined ? { budgetEur: v.budgetEur } : {}), ...(v.resume ? { pausedUntil: null } : {}) };
  await db.transaction(async (tx) => {
    await tx.insert(agentSettings).values({ agent: id, ...set }).onConflictDoUpdate({ target: agentSettings.agent, set });
    await audit(tx, actor, "agent.settings", { type: "agent", id }, null, set);
  });
}

/* ───────────── KPIs (from the company's data) ───────────── */

type Window = { from: Date; to: Date };
type Measure = { value: number | null; n: number; spentEur: number };

async function measure(db: Db, a: AgentDef, w: Window): Promise<Measure> {
  const spent = await spentEur(db, a.id, w.from, w.to);
  const inWin = (col: Parameters<typeof gte>[0]) => and(gte(col, w.from), lt(col, w.to));
  const per = (n: number) => ({ value: n ? round2(spent / n) : null, n, spentEur: spent });
  const kpi: Record<KpiId, () => Promise<Measure>> = {
    costPerLead: async () => per((await db.select({ n: sql<number>`count(*)::int` }).from(leads).where(inWin(leads.createdAt)))[0].n),
    costPerReply: async () => per((await db.select({ n: sql<number>`count(*)::int` }).from(prospects).where(inWin(prospects.repliedAt)))[0].n),
    unlockRate: async () => {
      const [r] = await db.select({ all: sql<number>`count(*)::int`, unlocked: sql<number>`count(${checkups.unlockedAt})::int` }).from(checkups).where(inWin(checkups.createdAt));
      return { value: r.all ? Math.round((r.unlocked / r.all) * 100) : null, n: r.all, spentEur: spent };
    },
    costPerActiveCustomer: async () => per((await db.select({ n: countDistinct(portalThreads.orgId) }).from(portalMessages).innerJoin(portalThreads, eq(portalThreads.id, portalMessages.threadId)).where(inWin(portalMessages.createdAt)))[0].n),
    costPerActivePartner: async () => per((await db.select({ n: sql<number>`count(*)::int` }).from(partners).where(eq(partners.status, "active")))[0].n),
    judgeAgreement: async () => {
      const rows = await db.select().from(qaReviews).where(inWin(qaReviews.createdAt));
      const byDelivery = new Map<string, typeof rows>();
      for (const r of rows) byDelivery.set(r.deliveryId, [...(byDelivery.get(r.deliveryId) ?? []), r]);
      let both = 0;
      let agree = 0;
      for (const rs of byDelivery.values()) {
        const j = rs.find((r) => r.by === "judge");
        const h = rs.find((r) => r.by.startsWith("user:"));
        if (!j || !h || j.verdict === "review") continue;
        both++;
        if (j.verdict === h.verdict) agree++;
      }
      return { value: both ? Math.round((agree / both) * 100) : null, n: both, spentEur: spent };
    },
    costPerConversation: async () => per((await db.select({ n: countDistinct(inbox.party) }).from(inbox).where(and(eq(inbox.channel, "whatsapp"), inWin(inbox.createdAt))))[0].n),
  };
  return kpi[a.kpi.id]();
}

const meets = (a: AgentDef, v: number | null) => v === null || (a.kpi.better === "lower" ? v <= a.kpi.target : v >= a.kpi.target);

export type AgentRow = Awaited<ReturnType<typeof agentStatus>> & { kpi: Measure & { met: boolean }; prevKpi: Measure & { met: boolean }; runs30: number; failed30: number; lastRun: Date | null; decision: string | null };

/** The board for the cockpit and the brief: status, money, KPI now and two weeks earlier, and a decision when both miss. */
export async function agentBoard(db: Db, now = new Date()): Promise<AgentRow[]> {
  const rows: AgentRow[] = [];
  for (const a of AGENTS) {
    const st = await agentStatus(db, a.id, now);
    const cur = await measure(db, a, { from: new Date(now.getTime() - 14 * DAY), to: now });
    const prev = await measure(db, a, { from: new Date(now.getTime() - 28 * DAY), to: new Date(now.getTime() - 14 * DAY) });
    const [r] = await db.select({ n: sql<number>`count(*)::int`, failed: sql<number>`count(*) filter (where not ${agentRuns.ok})::int`, last: sql<Date | null>`max(${agentRuns.createdAt})` }).from(agentRuns).where(and(spendFilter(a.id), gte(agentRuns.createdAt, new Date(now.getTime() - 30 * DAY))));
    const kpi = { ...cur, met: meets(a, cur.value) };
    const prevKpi = { ...prev, met: meets(a, prev.value) };
    // value filter: two weeks in a row under target while spending money → keep or stop is Javad's call
    const decision = !kpi.met && !prevKpi.met && cur.spentEur > 0 && prev.spentEur > 0 ? `${a.name}: ${a.kpi.label} ${kpi.value}${a.kpi.unit} vs target ${a.kpi.target}${a.kpi.unit} for 2 weeks (€${cur.spentEur + prev.spentEur} spent). Keep, change or stop?` : null;
    rows.push({ ...st, kpi, prevKpi, runs30: r.n, failed30: r.failed, lastRun: r.last ? new Date(r.last) : null, decision });
  }
  return rows;
}

export async function monthSpend(db: Db, now = new Date()) {
  const [r] = await db.select({ eur: sum(agentRuns.costEur) }).from(agentRuns).where(gte(agentRuns.createdAt, monthStart(now)));
  return round2(Number(r?.eur ?? 0));
}


