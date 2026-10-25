import { and, count, desc, eq, gte, inArray, gt, isNotNull, isNull, lt, sql, sum } from "drizzle-orm";
import { MODULES, type ModuleDef, SYSTEMS } from "@/config/modules";
import { STEPS } from "@/config/process-map";
import type { Db } from "@/db";
import {
  agentRuns, apiKeys, checkups, companyPages, complaints, contacts, contentItems, contentRevisions, contracts, customerApprovals, customerHealth, customerRequests, deliveries, events,
  experiments, invoices, orders, inviteTokens, jobs, leads, lessons, milestones, notifications, outcomes, partnerDocuments, partnerMessages, partners, payouts, portalMessages,
  projectInputs, projects, prospects, protocols, subscriptions, supplyGaps, touches,
} from "@/db/schema";
import { MAX_ATTEMPTS } from "@/worker/dispatch";
import { type AgentRow, agentBoard, monthSpend } from "./agents";
import { jobBoard } from "./orchestrator";
import { lastMarketRun } from "./market-filters";
import { isStopped } from "./switches";
import { MARGIN_FLOOR, margins, periodOf } from "./service";

/*
 * Cockpit › Systems (step 10): every module of the machine in one table — status light, last activity, cost,
 * KPI and the control that belongs to it (agent switch, job switch, page). Status comes from the agent registry,
 * the orchestrator's job log, missing .env keys and the event log. Nothing here is typed by hand.
 */

const DAY = 864e5;
export type Status = "live" | "key" | "off" | "paused" | "stopped" | "failing" | "manual";
export type SystemRow = ModuleDef & { status: Status; why: string; lastAt: Date | null; costEur: number | null; kpiText: string; enabled: boolean | null };

const monthStart = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
const n = async (q: Promise<{ n: number }[]>) => Number((await q)[0]?.n ?? 0);
const eur = (v: number) => `€${Math.round(v).toLocaleString("en-GB")}`;
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

type Ctx = { db: Db; now: Date; month: Date; agents: AgentRow[] };

const KPI: Record<string, (c: Ctx) => Promise<string>> = {
  filters: async () => `last run ${lastMarketRun() ?? "never"}`,
  quotes: async ({ db }) => `${await n(db.select({ n: count() }).from(customerRequests).where(and(eq(customerRequests.status, "open"), inArray(customerRequests.kind, ["solution", "change"]))))} prices promised, ${await n(db.select({ n: count() }).from(customerRequests).where(and(eq(customerRequests.status, "open"), lt(customerRequests.dueAt, new Date()))))} late`,
  complaints: async ({ db, month }) => `${await n(db.select({ n: count() }).from(complaints).where(eq(complaints.status, "open")))} open, ${await n(db.select({ n: count() }).from(complaints).where(gte(complaints.createdAt, month)))} this month`,
  ratings: async ({ db, month }) => {
    const [r] = await db.select({ n: count(milestones.rating), avg: sql<number | null>`avg(${milestones.rating})::float` }).from(milestones).where(gte(milestones.acceptedAt, month));
    return r.n ? `${Math.round((r.avg ?? 0) * 10) / 10}/5 from ${r.n} this month` : "no ratings this month";
  },
  autoAccepted: async ({ db, month }) => `${await n(db.select({ n: count() }).from(milestones).where(and(eq(milestones.acceptedBy, "auto"), gte(milestones.acceptedAt, month))))} accepted by silence this month`,
  reworks: async ({ db, month }) => `${await n(db.select({ n: count() }).from(jobs).where(and(eq(jobs.role, "revision"), gte(jobs.createdAt, month))))} reworks this month`,
  monthlyService: async ({ db, now }) => {
    const [r] = await db.select({ n: count(), done: sql<number>`count(*) filter (where ${jobs.status} in ('accepted', 'paid'))::int` }).from(jobs).where(eq(jobs.period, periodOf(now)));
    return `${r.n} monthly check-ups this month, ${r.done} done`;
  },
  margin: async ({ db, now }) => {
    const m = [...(await margins(db, periodOf(now))).values()];
    const fee = m.reduce((s, x) => s + x.feeEur, 0);
    const cost = m.reduce((s, x) => s + x.costEur, 0);
    return fee ? `${Math.round(((fee - cost) / fee) * 100)}% on €${fee} MRR, ${m.filter((x) => x.marginPct !== null && x.marginPct < MARGIN_FLOOR).length} under ${MARGIN_FLOOR}%` : "no running subscriptions";
  },
  churn: async ({ db, now, month }) => `${await n(db.select({ n: count() }).from(subscriptions).where(and(eq(subscriptions.status, "active"), gt(subscriptions.endsAt, now))))} on notice, ${await n(db.select({ n: count() }).from(events).where(and(eq(events.type, "loss.recorded"), gte(events.createdAt, month))))} losses with a reason this month`,
  supplyGaps: async ({ db, month }) => `${await n(db.select({ n: count() }).from(supplyGaps).where(eq(supplyGaps.status, "open")))} skills missing, ${await n(db.select({ n: count() }).from(supplyGaps).where(and(eq(supplyGaps.status, "closed"), gte(supplyGaps.closedAt, month))))} filled this month`,
  unpaidMilestones: async ({ db }) => `${await n(db.select({ n: count() }).from(milestones).where(eq(milestones.status, "unpaid")))} milestones waiting for payment`,
  hubPages: async ({ db }) => `${await n(db.select({ n: count() }).from(contentItems).where(eq(contentItems.status, "published")))} pages live`,
  leadsMonth: async ({ db, month }) => `${await n(db.select({ n: count() }).from(leads).where(gte(leads.createdAt, month)))} leads this month`,
  reminders: async ({ db, month }) => `${await n(db.select({ n: count() }).from(events).where(and(eq(events.type, "lead.reminder_due"), gte(events.createdAt, month))))} reminders this month`,
  hubIssues: async () => "see Markets › Live hubs",
  checkups: async ({ db, month }) => {
    const [r] = await db.select({ all: count(), unlocked: count(checkups.unlockedAt) }).from(checkups).where(gte(checkups.createdAt, month));
    return `${r.all} this month, ${pct(r.unlocked, r.all)} unlocked`;
  },
  unlockRate: async ({ db, now }) => {
    const [r] = await db.select({ all: count(), unlocked: count(checkups.unlockedAt) }).from(checkups).where(gte(checkups.createdAt, new Date(now.getTime() - 30 * DAY)));
    return `${pct(r.unlocked, r.all)} unlocked (30 days)`;
  },
  prospects: async ({ db, month }) => `${await n(db.select({ n: count() }).from(prospects).where(gte(prospects.createdAt, month)))} companies added this month`,
  contacts: async ({ db }) => `${await n(db.select({ n: count() }).from(contacts))} decision-makers`,
  pageViews: async ({ db }) => `${await n(db.select({ n: count() }).from(companyPages).where(isNotNull(companyPages.firstViewedAt)))} pages viewed`,
  drafts: async ({ db }) => `${await n(db.select({ n: count() }).from(touches).where(eq(touches.status, "draft")))} messages wait for you`,
  blockedTouches: async ({ db }) => `${await n(db.select({ n: count() }).from(touches).where(and(inArray(touches.status, ["draft", "approved"]), isNotNull(touches.blockedReason))))} touches blocked`,
  touchesSent: async ({ db, month }) => `${await n(db.select({ n: count() }).from(touches).where(gte(touches.sentAt, month)))} sent this month`,
  inbound: async ({ db, now }) => `${await n(db.select({ n: count() }).from(events).where(and(inArray(events.type, ["checkup.call_requested", "company_page.viewed", "whatsapp.received"]), gte(events.createdAt, new Date(now.getTime() - 7 * DAY)))))} inbound in 7 days`,
  replies: async ({ db, month }) => `${await n(db.select({ n: count() }).from(prospects).where(gte(prospects.repliedAt, month)))} replies this month`,
  confirmRate: async ({ db, month }) => {
    const [r] = await db.select({ all: count(), ok: count(leads.confirmedAt) }).from(leads).where(gte(leads.createdAt, month));
    return `${pct(r.ok, r.all)} confirmed this month`;
  },
  experiments: async ({ db }) => `${await n(db.select({ n: count() }).from(experiments).where(eq(experiments.status, "running")))} running`,
  orders: async ({ db, month }) => `${await n(db.select({ n: count() }).from(orders).where(gte(orders.createdAt, month)))} orders this month`,
  contracts: async ({ db }) => `${await n(db.select({ n: count() }).from(contracts).where(eq(contracts.status, "sent")))} waiting for signature`,
  portalChats: async ({ db, month }) => `${await n(db.select({ n: count() }).from(portalMessages).where(and(eq(portalMessages.role, "user"), gte(portalMessages.createdAt, month))))} customer messages this month`,
  results: async ({ db, month }) => `${eur(Number((await db.select({ v: sum(outcomes.eur) }).from(outcomes).where(gte(outcomes.at, month)))[0]?.v ?? 0))} won back for customers this month`,
  customerWaiting: async ({ db }) => `${await n(db.select({ n: count() }).from(customerApprovals).where(eq(customerApprovals.status, "pending")))} waiting on customers`,
  openRequests: async ({ db }) => `${await n(db.select({ n: count() }).from(customerRequests).where(eq(customerRequests.status, "open")))} open requests`,
  mrr: async ({ db }) => `MRR ${eur(Number((await db.select({ v: sum(subscriptions.monthlyEur) }).from(subscriptions).where(eq(subscriptions.status, "active")))[0]?.v ?? 0))}`,
  atRisk: async ({ db }) => {
    const rows = await db.select({ orgId: customerHealth.orgId, band: customerHealth.band, week: customerHealth.week }).from(customerHealth).orderBy(desc(customerHealth.week));
    const seen = new Set<string>();
    const latest = rows.filter((r) => !seen.has(r.orgId) && seen.add(r.orgId));
    return latest.length ? `${latest.filter((r) => r.band === "red").length} red of ${latest.length}` : "first score on Monday";
  },
  stories: async ({ db }) => `${await n(db.select({ n: count() }).from(customerApprovals).where(sql`${customerApprovals.createdBy} = 'system:customer-success'`))} asked`,
  projects: async ({ db }) => `${await n(db.select({ n: count() }).from(projects).where(eq(projects.status, "running")))} running`,
  qaQueue: async ({ db }) => `${await n(db.select({ n: count() }).from(deliveries).where(eq(deliveries.status, "submitted")))} deliveries to review`,
  milestones: async ({ db }) => `${await n(db.select({ n: count() }).from(milestones).where(eq(milestones.status, "ready")))} waiting for the customer's OK`,
  lessons: async ({ db }) => `${await n(db.select({ n: count() }).from(lessons).where(eq(lessons.area, "delivery")))} delivery lessons`,
  protocols: async ({ db }) => `${await n(db.select({ n: count() }).from(protocols))} protocols`,
  inputsWaiting: async ({ db }) => `${await n(db.select({ n: count() }).from(projectInputs).where(eq(projectInputs.status, "check")))} files wait for your check`,
  applications: async ({ db }) => `${await n(db.select({ n: count() }).from(partners).where(eq(partners.status, "applied")))} to decide · ${await n(db.select({ n: count() }).from(partners).where(eq(partners.status, "active")))} active`,
  openJobs: async ({ db }) => `${await n(db.select({ n: count() }).from(jobs).where(inArray(jobs.status, ["open", "offered"])))} jobs without a partner yet`,
  flagged: async ({ db, month }) => `${await n(db.select({ n: count() }).from(partnerMessages).where(and(eq(partnerMessages.flagged, true), gte(partnerMessages.createdAt, month))))} masked this month`,
  firstPass: async ({ db, now }) => {
    const [r] = await db.select({ all: count(), ok: sql<number>`count(*) filter (where ${deliveries.status} = 'accepted' and ${deliveries.version} = 1)::int` }).from(deliveries).where(gte(deliveries.createdAt, new Date(now.getTime() - 30 * DAY)));
    return `${pct(r.ok, r.all)} accepted first time (30 days)`;
  },
  payoutsDue: async ({ db }) => `${eur(Number((await db.select({ v: sum(payouts.amountEur) }).from(payouts).where(eq(payouts.status, "due")))[0]?.v ?? 0))} due to partners`,
  docsPending: async ({ db }) => `${await n(db.select({ n: count() }).from(partnerDocuments).where(eq(partnerDocuments.status, "pending")))} documents to check`,
  agentPartners: async ({ db }) => `${await n(db.select({ n: count() }).from(partners).where(and(eq(partners.kind, "agent"), eq(partners.status, "active"))))} agent partners`,
  openInvoices: async ({ db }) => `${eur(Number((await db.select({ v: sum(invoices.totalEur) }).from(invoices).where(eq(invoices.status, "requested")))[0]?.v ?? 0))} open`,
  overdue: async ({ db, now }) => `${eur(Number((await db.select({ v: sum(invoices.totalEur) }).from(invoices).where(and(eq(invoices.status, "requested"), lt(invoices.dueAt, now))))[0]?.v ?? 0))} overdue`,
  apiKeys: async ({ db }) => `${await n(db.select({ n: count() }).from(apiKeys).where(isNull(apiKeys.revokedAt)))} active keys`,
  outbox: async ({ db }) => `${await n(db.select({ n: count() }).from(notifications).where(eq(notifications.status, "queued")))} queued · ${await n(db.select({ n: count() }).from(notifications).where(eq(notifications.status, "failed")))} failed`,
  invites: async ({ db }) => `${await n(db.select({ n: count() }).from(inviteTokens).where(isNotNull(inviteTokens.usedAt)))} of ${await n(db.select({ n: count() }).from(inviteTokens))} redeemed`,
  stuck: async ({ db }) => {
    const [e] = await db.select({ p: events.payload }).from(events).where(eq(events.type, "ops.flagged")).orderBy(desc(events.id)).limit(1);
    const c = (e?.p.counts as Record<string, number> | undefined) ?? {};
    return `${Object.values(c).reduce((s, x) => s + x, 0)} open items at last check`;
  },
  gaps: async () => {
    const gaps = STEPS.filter((s) => s.gap);
    return `${gaps.length} open gaps (${gaps.filter((s) => s.impact === 1).length} costing money now)`;
  },
  jobsFailed: async ({ db, now }) => `${(await jobBoard(db, now)).filter((j) => j.ok === false).length} jobs failing`,
  aiSpend: async ({ db, now }) => `${eur(await monthSpend(db, now))} this month`,
  lessonsActive: async ({ db }) => `${await n(db.select({ n: count() }).from(lessons).where(eq(lessons.active, true)))} lessons in use`,
  deadEvents: async ({ db }) => `${await n(db.select({ n: count() }).from(events).where(and(isNull(events.dispatchedAt), gte(events.attempts, MAX_ATTEMPTS))))} events failed every retry`,
};

async function lastActivity(db: Db, m: ModuleDef): Promise<Date | null> {
  const dates: Date[] = [];
  if (m.events?.length) {
    const [e] = await db.select({ at: events.createdAt }).from(events).where(inArray(events.type, m.events)).orderBy(desc(events.id)).limit(1);
    if (e) dates.push(e.at);
  }
  if (m.script === "market-selection") {
    const d = lastMarketRun();
    if (d) dates.push(new Date(`${d}T12:00:00Z`));
  }
  if (m.script === "hub-builder") {
    const [r] = await db.select({ at: contentRevisions.createdAt }).from(contentRevisions).where(sql`${contentRevisions.actor} like 'agent:%'`).orderBy(desc(contentRevisions.createdAt)).limit(1);
    if (r) dates.push(r.at);
  }
  if (m.script === "outbound") {
    const [r] = await db.select({ at: agentRuns.createdAt }).from(agentRuns).where(eq(agentRuns.action, "prospect.add")).orderBy(desc(agentRuns.createdAt)).limit(1);
    if (r) dates.push(r.at);
  }
  return dates.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
}

const missing = (keys: string[] = [], env = process.env) => keys.filter((k) => !env[k]);

/** Every module with its status, last activity, cost and KPI (Cockpit › Systems). */
export async function systemsBoard(db: Db, now = new Date(), env = process.env) {
  const agents = await agentBoard(db, now);
  const jobsNow = await jobBoard(db, now);
  const stopped = await isStopped(db);
  const ctx: Ctx = { db, now, month: monthStart(now), agents };
  const rows: SystemRow[] = [];
  for (const m of MODULES) {
    const a = m.agent ? agents.find((x) => x.def.id === m.agent) : undefined;
    const j = m.job ? jobsNow.find((x) => x.id === m.job) : undefined;
    const keys = missing(m.needs, env);
    let status: Status = "live";
    let why = "";
    if (a && !a.enabled) [status, why] = ["off", "agent switched off"];
    else if (j && !j.enabled) [status, why] = ["off", "job switched off"];
    else if (stopped && (a || j?.outward)) [status, why] = ["stopped", "emergency stop"];
    else if (keys.length) [status, why] = ["key", `waiting for ${keys.join(", ")}`];
    else if (a?.paused) [status, why] = ["paused", `budget reached, paused to ${a.pausedUntil?.toISOString().slice(0, 10)}`];
    else if (j?.ok === false) [status, why] = ["failing", j.error?.slice(0, 120) ?? "last run failed"];
    else if (a && a.failed30 > 0 && a.failed30 * 2 >= a.runs30) [status, why] = ["failing", `${a.failed30} of ${a.runs30} runs failed`];
    else if (m.script && m.script !== "market-selection" && m.script !== "hub-builder") [status, why] = ["manual", "started by hand until the server scheduler (step 11)"];
    const lastAt = [a?.lastRun ?? null, j?.lastAt ?? null, await lastActivity(db, m)].filter((d): d is Date => Boolean(d)).sort((x, y) => y.getTime() - x.getTime())[0] ?? null;
    const kpiText = a ? `${a.kpi.value === null ? "–" : a.def.kpi.unit === "€" ? `€${a.kpi.value}` : `${a.kpi.value}%`} ${a.def.kpi.label}` : m.kpi ? await KPI[m.kpi](ctx).catch((e: Error) => `error: ${e.message.slice(0, 60)}`) : "–";
    rows.push({ ...m, status, why, lastAt, costEur: a ? a.spentEur : null, kpiText, enabled: a ? a.enabled : j ? j.enabled : null });
  }
  const bySystem = SYSTEMS.map((s) => {
    const mine = rows.filter((r) => r.system === s.id);
    const worst = mine.some((r) => r.status === "failing" || r.status === "stopped") ? "red" : mine.some((r) => r.status === "key" || r.status === "paused" || r.status === "off") ? "amber" : "green";
    return { ...s, rows: mine, light: worst as "red" | "amber" | "green" };
  });
  const counts = rows.reduce<Record<Status, number>>((c, r) => ((c[r.status] = (c[r.status] ?? 0) + 1), c), {} as Record<Status, number>);
  return { stopped, systems: bySystem, counts, total: rows.length };
}

/** Which keys are set (never their values): Cockpit › API & connections. */
export function connections(env = process.env) {
  const set = (...k: string[]) => k.every((x) => Boolean(env[x]));
  return [
    { name: "Claude API", why: "agents think: research, chat, QA judge, advisors", ok: set("ANTHROPIC_API_KEY"), keys: "ANTHROPIC_API_KEY" },
    { name: "Brevo (email)", why: "every email: invites, contracts, invoices, reminders, outreach", ok: set("BREVO_API_KEY", "MAIL_FROM"), keys: "BREVO_API_KEY, MAIL_FROM" },
    { name: "Telegram", why: "approvals, alerts, daily brief on your phone", ok: set("TELEGRAM_BOT_TOKEN", "TELEGRAM_ADMIN_CHAT_ID"), keys: "TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID" },
    { name: "Apify (Google Maps)", why: "company finder", ok: set("APIFY_TOKEN"), keys: "APIFY_TOKEN" },
    { name: "Apollo", why: "decision-makers' names", ok: set("APOLLO_API_KEY"), keys: "APOLLO_API_KEY" },
    { name: "Vapi (AI calls)", why: "AI voice calls where allowed", ok: set("VAPI_API_KEY", "VAPI_ASSISTANT_ID", "VAPI_PHONE_NUMBER_ID"), keys: "VAPI_API_KEY, VAPI_ASSISTANT_ID, VAPI_PHONE_NUMBER_ID" },
    { name: "WhatsApp Business", why: "WhatsApp agent", ok: set("WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"), keys: "WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID" },
    { name: "n8n", why: "every event to your workflows", ok: set("N8N_EVENTS_WEBHOOK_URL"), keys: "N8N_EVENTS_WEBHOOK_URL" },
  ];
}
