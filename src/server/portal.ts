import { randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db, DbOrTx } from "@/db";
import {
  account,
  checkups,
  customerApprovals,
  customerRequests,
  goals,
  memberships,
  organizations,
  outcomes,
  portalMessages,
  portalThreads,
  servicePackages,
  subscriptions,
  user,
} from "@/db/schema";
import { type L, products } from "@/mock/site";
import type { Actor } from "./actor";
import { AppError, notFound } from "./errors";
import { audit, emit } from "./events";
import { onApprovalDecided } from "./projects";
import { METRICS } from "./portal-metrics";

/*
 * Customer dashboard (step 5, doc 15 §6و). Every function takes the customer's org id and only ever reads or
 * writes that org's rows. The home page is a conversation (portal-chat.ts); these functions are what it shows
 * and does. Results are € the customer gets back, compared with the fixed monthly fee and the starting point
 * from their first check-up (Javad: we sell results, not tools or usage).
 */

export const tl = (v: L | Record<string, string> | undefined, lang: string) => (v ? ((v as Record<string, string>)[lang] ?? v.en ?? "") : "");

const monthStart = (d: Date, back = 0) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - back, 1));

/** The customer org a signed-in user belongs to (first one; multi-org switch comes with agencies). */
export async function customerOrgFor(db: Db, userId: string) {
  const [row] = await db
    .select({ org: organizations, role: memberships.role })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.orgId))
    .where(and(eq(memberships.userId, userId), eq(organizations.kind, "customer")))
    .orderBy(asc(organizations.createdAt))
    .limit(1);
  return row ?? null;
}

/** Admins (Javad) open the dashboard as the oldest customer, to see what customers see. */
export async function firstCustomerOrg(db: Db) {
  const [org] = await db.select().from(organizations).where(eq(organizations.kind, "customer")).orderBy(asc(organizations.createdAt)).limit(1);
  return org ?? null;
}

export async function getOrg(db: Db, orgId: string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  if (!org) throw notFound("organization");
  return org;
}

/* ───────────── Results ───────────── */

export type Results = {
  feeEur: number;
  baselineEur: number | null;
  month: { eur: number; byMetric: { metric: string; value: number; eur: number }[] };
  lastMonth: { eur: number };
  sinceStart: { eur: number; since: string | null };
  // € back for each € of fee this month
  roi: number | null;
  // share of the starting monthly loss won back this month
  recovered: number | null;
  series: { month: string; eur: number }[];
};

export async function results(db: Db, orgId: string, now = new Date()): Promise<Results> {
  const subs = await db.select().from(subscriptions).where(and(eq(subscriptions.orgId, orgId), eq(subscriptions.status, "active")));
  const org = await getOrg(db, orgId);
  const from = monthStart(now, 5);
  const rows = await db
    .select({ month: sql<string>`to_char(date_trunc('month', ${outcomes.at}), 'YYYY-MM')`, metric: outcomes.metric, value: sql<number>`sum(${outcomes.value})::float`, eur: sql<number>`sum(${outcomes.eur})::int` })
    .from(outcomes)
    .where(and(eq(outcomes.orgId, orgId), gte(outcomes.at, from)))
    .groupBy(sql`1`, outcomes.metric);
  const [all] = await db.select({ eur: sql<number>`coalesce(sum(${outcomes.eur}), 0)::int`, since: sql<string | null>`min(${outcomes.at})::date::text` }).from(outcomes).where(eq(outcomes.orgId, orgId));
  const key = (d: Date) => d.toISOString().slice(0, 7);
  const thisKey = key(monthStart(now));
  const lastKey = key(monthStart(now, 1));
  const series = [5, 4, 3, 2, 1, 0].map((b) => {
    const m = key(monthStart(now, b));
    return { month: m, eur: rows.filter((r) => r.month === m).reduce((s, r) => s + r.eur, 0) };
  });
  const month = rows.filter((r) => r.month === thisKey);
  const fee = subs.reduce((s, x) => s + x.monthlyEur, 0);
  const eur = month.reduce((s, r) => s + r.eur, 0);
  // the month so far is compared with the last full month when it is still early
  return {
    feeEur: fee,
    baselineEur: org.baselineEur,
    month: { eur, byMetric: month.map((r) => ({ metric: r.metric, value: Math.round(r.value * 10) / 10, eur: r.eur })).sort((a, b) => b.eur - a.eur) },
    lastMonth: { eur: series.find((s) => s.month === lastKey)!.eur },
    sinceStart: { eur: all.eur, since: all.since },
    roi: fee ? Math.round((eur / fee) * 10) / 10 : null,
    recovered: org.baselineEur ? Math.min(1, Math.round((eur / org.baselineEur) * 100) / 100) : null,
    series,
  };
}

export const outcomeInput = z.object({
  orgId: z.string().uuid(),
  subscriptionId: z.string().uuid().optional(),
  metric: z.enum(METRICS.map((m) => m.id) as [string, ...string[]]),
  value: z.number().positive().max(1e7),
  eur: z.number().int().min(0).max(1e7),
  at: z.coerce.date().optional(),
});

/** Agents and the team record a delivered result (API scope outcomes:write). */
export async function addOutcome(db: Db, actor: Actor, input: z.infer<typeof outcomeInput>) {
  const v = outcomeInput.parse(input);
  return db.transaction(async (tx) => {
    const [org] = await tx.select({ id: organizations.id }).from(organizations).where(and(eq(organizations.id, v.orgId), eq(organizations.kind, "customer")));
    if (!org) throw notFound("organization");
    if (v.subscriptionId) {
      const [s] = await tx.select({ id: subscriptions.id }).from(subscriptions).where(and(eq(subscriptions.id, v.subscriptionId), eq(subscriptions.orgId, v.orgId)));
      if (!s) throw notFound("subscription");
    }
    const [row] = await tx.insert(outcomes).values({ ...v, at: v.at ?? new Date(), source: `${actor.type}:${actor.id}` }).returning();
    await emit(tx, actor, "outcome.recorded", { type: "organization", id: v.orgId }, { metric: v.metric, value: v.value, eur: v.eur });
    await audit(tx, actor, "outcome.recorded", { type: "outcome", id: row.id }, null, v);
    return row;
  });
}

/* ───────────── Goals, services, next step ───────────── */

export async function listGoals(db: Db, orgId: string, lang: string) {
  const rows = await db.select().from(goals).where(eq(goals.orgId, orgId)).orderBy(asc(goals.createdAt));
  return rows.map((g) => {
    const cur = g.current ?? g.baseline;
    const span = g.target - g.baseline;
    return { id: g.id, title: tl(g.title, lang), metric: g.metric, unit: g.unit, baseline: g.baseline, target: g.target, current: cur, due: g.due?.toISOString().slice(0, 10) ?? null, progress: span ? Math.max(0, Math.min(1, (cur - g.baseline) / span)) : 1 };
  });
}

export async function listServices(db: Db, orgId: string, lang: string, now = new Date()) {
  const subs = await db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)).orderBy(asc(subscriptions.startedAt));
  const ids = subs.map((s) => s.id);
  const month = ids.length
    ? await db
        .select({ sub: outcomes.subscriptionId, metric: outcomes.metric, value: sql<number>`sum(${outcomes.value})::float`, eur: sql<number>`sum(${outcomes.eur})::int` })
        .from(outcomes)
        .where(and(inArray(outcomes.subscriptionId, ids), gte(outcomes.at, monthStart(now))))
        .groupBy(outcomes.subscriptionId, outcomes.metric)
    : [];
  return subs.map((s) => {
    const p = products.find((x) => x.slug === s.product);
    const mine = month.filter((m) => m.sub === s.id);
    return {
      id: s.id,
      product: s.product,
      icon: p?.icon ?? "✓",
      name: tl(p?.name, lang) || s.product,
      promise: tl(p?.outcome, lang),
      plan: s.plan,
      monthlyEur: s.monthlyEur,
      status: s.status,
      since: s.startedAt.toISOString().slice(0, 10),
      month: { eur: mine.reduce((a, m) => a + m.eur, 0), metrics: mine.map((m) => ({ metric: m.metric, value: Math.round(m.value) })) },
    };
  });
}

/** The next problem worth solving: a catalogue result for this trade the customer does not have yet. */
export async function nextStep(db: Db, orgId: string, lang: string) {
  const org = await getOrg(db, orgId);
  const have = new Set((await db.select({ p: subscriptions.product }).from(subscriptions).where(eq(subscriptions.orgId, orgId))).map((r) => r.p));
  const p = products.find((x) => org.industry && x.industries.includes(org.industry) && !have.has(x.slug) && (!x.countries || !org.country || x.countries.includes(org.country)));
  if (!p) return null;
  // a catalogue package can be ordered with one press; anything else goes to the team as an interest
  const [pkg] = await db.select({ slug: servicePackages.slug }).from(servicePackages).where(and(eq(servicePackages.slug, p.slug), eq(servicePackages.active, true)));
  return { product: p.slug, icon: p.icon, name: tl(p.name, lang), outcome: tl(p.outcome, lang), fromEur: Math.min(...p.plans.map((x) => x.price)), orderable: Boolean(pkg) };
}

/* ───────────── Approvals the customer gives ───────────── */

export async function pendingApprovals(db: Db, orgId: string) {
  return db.select().from(customerApprovals).where(and(eq(customerApprovals.orgId, orgId), eq(customerApprovals.status, "pending"))).orderBy(asc(customerApprovals.createdAt));
}

export const approvalInput = z.object({ orgId: z.string().uuid(), title: z.string().min(3).max(200), detail: z.string().max(4000).optional(), link: z.string().url().max(500).optional() });

/** Team or agent puts something in front of the customer for a yes. */
export async function askCustomerApproval(db: Db, actor: Actor, input: z.infer<typeof approvalInput>) {
  const v = approvalInput.parse(input);
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(customerApprovals).values({ ...v, createdBy: `${actor.type}:${actor.id}` }).returning();
    await emit(tx, actor, "customer_approval.requested", { type: "customer_approval", id: row.id }, { orgId: v.orgId, title: v.title });
    await audit(tx, actor, "customer_approval.requested", { type: "customer_approval", id: row.id }, null, v);
    return row;
  });
}

export async function decideCustomerApproval(db: Db, actor: Actor, orgId: string, id: string, decision: "approved" | "changes", note?: string) {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(customerApprovals).where(and(eq(customerApprovals.id, id), eq(customerApprovals.orgId, orgId)));
    if (!before) throw notFound("approval");
    if (before.status !== "pending") throw new AppError(409, "already_decided", "already decided");
    const [after] = await tx
      .update(customerApprovals)
      .set({ status: decision, note: note?.slice(0, 2000) ?? null, decidedBy: `${actor.type}:${actor.id}`, decidedAt: new Date() })
      .where(eq(customerApprovals.id, id))
      .returning();
    // a milestone or a change request of a project (step 7)
    await onApprovalDecided(tx, actor, after, decision);
    const [org] = await tx.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId));
    await emit(tx, actor, "customer_approval.decided", { type: "customer_approval", id }, { orgId, company: org.name, title: before.title, decision, note: note ?? null });
    await audit(tx, actor, "customer_approval.decided", { type: "customer_approval", id }, { status: before.status }, { status: decision, note });
    return after;
  });
}

/* ───────────── Requests ───────────── */

export const REQUEST_KINDS = ["solution", "change", "support", "upgrade", "data_delete"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export async function createRequest(db: Db, actor: Actor, orgId: string, userId: string | null, kind: RequestKind, text: string) {
  const body = text.trim().slice(0, 4000);
  if (body.length < 2) throw new AppError(400, "invalid", "empty request");
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(customerRequests).values({ orgId, userId, kind, text: body }).returning();
    const [org] = await tx.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId));
    await emit(tx, actor, "customer_request.created", { type: "customer_request", id: row.id }, { orgId, company: org.name, kind, text: body.slice(0, 500) });
    await audit(tx, actor, "customer_request.created", { type: "customer_request", id: row.id }, null, { kind, text: body });
    return row;
  });
}

export async function listRequests(db: Db, orgId: string) {
  return db.select().from(customerRequests).where(eq(customerRequests.orgId, orgId)).orderBy(desc(customerRequests.createdAt)).limit(100);
}

/* ───────────── Conversation history ───────────── */

export async function listThreads(db: Db, orgId: string, userId: string) {
  return db
    .select({ id: portalThreads.id, title: portalThreads.title, updatedAt: portalThreads.updatedAt })
    .from(portalThreads)
    .where(and(eq(portalThreads.orgId, orgId), eq(portalThreads.userId, userId)))
    .orderBy(desc(portalThreads.updatedAt))
    .limit(30);
}

export async function threadMessages(db: Db, orgId: string, userId: string, threadId: string) {
  const [t] = await db.select().from(portalThreads).where(and(eq(portalThreads.id, threadId), eq(portalThreads.orgId, orgId), eq(portalThreads.userId, userId)));
  if (!t) return null;
  const msgs = await db.select().from(portalMessages).where(eq(portalMessages.threadId, threadId)).orderBy(asc(portalMessages.createdAt));
  return { thread: t, messages: msgs };
}

/** Stores one exchange; starts a thread (titled by the first question) when there is none. */
export async function saveTurn(db: Db, orgId: string, userId: string, threadId: string | null, userText: string, reply: { text: string; cards: unknown[] }) {
  return db.transaction(async (tx) => {
    let id = threadId;
    if (id) {
      const [t] = await tx.select({ id: portalThreads.id }).from(portalThreads).where(and(eq(portalThreads.id, id), eq(portalThreads.orgId, orgId), eq(portalThreads.userId, userId)));
      if (!t) id = null;
    }
    if (!id) [{ id }] = await tx.insert(portalThreads).values({ orgId, userId, title: userText.slice(0, 80) }).returning({ id: portalThreads.id });
    else await tx.update(portalThreads).set({ updatedAt: new Date() }).where(eq(portalThreads.id, id));
    const now = Date.now();
    const [, bot] = await tx
      .insert(portalMessages)
      .values([
        { threadId: id!, role: "user", text: userText.slice(0, 4000), createdAt: new Date(now) },
        { threadId: id!, role: "assistant", text: reply.text, cards: reply.cards, createdAt: new Date(now + 1) },
      ])
      .returning({ id: portalMessages.id });
    return { threadId: id!, messageId: bot.id };
  });
}

/* ───────────── My data (GDPR art. 15 and 20) ───────────── */

export async function exportData(db: Db, orgId: string) {
  const org = await getOrg(db, orgId);
  const [subs, outs, gs, apps, reqs, members, threads] = await Promise.all([
    db.select().from(subscriptions).where(eq(subscriptions.orgId, orgId)),
    db.select().from(outcomes).where(eq(outcomes.orgId, orgId)),
    db.select().from(goals).where(eq(goals.orgId, orgId)),
    db.select().from(customerApprovals).where(eq(customerApprovals.orgId, orgId)),
    db.select().from(customerRequests).where(eq(customerRequests.orgId, orgId)),
    db.select({ name: user.name, email: user.email, role: memberships.role }).from(memberships).innerJoin(user, eq(user.id, memberships.userId)).where(eq(memberships.orgId, orgId)),
    db.select().from(portalThreads).where(eq(portalThreads.orgId, orgId)),
  ]);
  const msgs = threads.length ? await db.select().from(portalMessages).where(inArray(portalMessages.threadId, threads.map((t) => t.id))) : [];
  const checks = await db.select().from(checkups).where(eq(checkups.orgId, orgId));
  return { exportedAt: new Date().toISOString(), organization: org, members, subscriptions: subs, outcomes: outs, goals: gs, approvals: apps, requests: reqs, conversations: threads.map((t) => ({ ...t, messages: msgs.filter((m) => m.threadId === t.id) })), checkups: checks };
}

export async function listMembers(db: Db, orgId: string) {
  return db.select({ id: user.id, name: user.name, email: user.email, role: memberships.role }).from(memberships).innerJoin(user, eq(user.id, memberships.userId)).where(eq(memberships.orgId, orgId));
}

export async function setOrgLocale(db: Db, actor: Actor, orgId: string, locale: string) {
  await db.transaction(async (tx) => {
    const [before] = await tx.select({ locale: organizations.locale }).from(organizations).where(eq(organizations.id, orgId));
    await tx.update(organizations).set({ locale }).where(eq(organizations.id, orgId));
    await audit(tx, actor, "organization.locale", { type: "organization", id: orgId }, before, { locale });
  });
}

/* ───────────── Opening an account ───────────── */

export const customerInput = z.object({
  name: z.string().min(2).max(200),
  country: z.string().length(2),
  industry: z.string().min(2).max(40),
  locale: z.string().min(2).max(10),
  baselineEur: z.number().int().min(0).nullable().optional(),
  prospectId: z.string().uuid().optional(),
  email: z.string().email(),
  contactName: z.string().min(1).max(120),
});

/** Opens a customer account with its first user; returns a one-time password Javad passes on (invites by email later). */
export async function createCustomer(tx: DbOrTx, actor: Actor, input: z.infer<typeof customerInput>, password = randomBytes(12).toString("base64url")) {
  const v = customerInput.parse(input);
  const slug = `${v.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-${randomBytes(3).toString("hex")}`;
  const [org] = await tx
    .insert(organizations)
    .values({ name: v.name, slug, kind: "customer", country: v.country.toUpperCase(), industry: v.industry, locale: v.locale, baselineEur: v.baselineEur ?? null, prospectId: v.prospectId })
    .returning();
  const email = v.email.toLowerCase();
  let [u] = await tx.select().from(user).where(eq(user.email, email));
  if (!u) {
    [u] = await tx.insert(user).values({ id: randomUUID(), name: v.contactName, email, emailVerified: true, role: "member" }).returning();
    await tx.insert(account).values({ id: randomUUID(), accountId: u.id, providerId: "credential", userId: u.id, password: await hashPassword(password) });
  } else password = "";
  await tx.insert(memberships).values({ orgId: org.id, userId: u.id, role: "owner" }).onConflictDoNothing();
  await emit(tx, actor, "customer.created", { type: "organization", id: org.id }, { name: v.name, industry: v.industry, country: v.country });
  await audit(tx, actor, "customer.created", { type: "organization", id: org.id }, null, { ...v });
  return { org, userId: u.id, password };
}

export async function addSubscription(tx: DbOrTx, actor: Actor, orgId: string, product: string, plan: string, monthlyEur: number, startedAt = new Date()) {
  const [row] = await tx.insert(subscriptions).values({ orgId, product, plan, monthlyEur, startedAt }).returning();
  await emit(tx, actor, "subscription.started", { type: "subscription", id: row.id }, { orgId, product, plan, monthlyEur });
  await audit(tx, actor, "subscription.started", { type: "subscription", id: row.id }, null, { product, plan, monthlyEur });
  return row;
}

/* ───────────── Cockpit side (team) ───────────── */

/** Every customer with its fee, this month's results and what waits on us. */
export async function listCustomers(db: Db, now = new Date()) {
  const orgs = await db.select().from(organizations).where(eq(organizations.kind, "customer")).orderBy(asc(organizations.name));
  return Promise.all(
    orgs.map(async (o) => {
      const r = await results(db, o.id, now);
      const [open] = await db.select({ n: sql<number>`count(*)::int` }).from(customerRequests).where(and(eq(customerRequests.orgId, o.id), sql`${customerRequests.status} <> 'done'`));
      const [waiting] = await db.select({ n: sql<number>`count(*)::int` }).from(customerApprovals).where(and(eq(customerApprovals.orgId, o.id), eq(customerApprovals.status, "pending")));
      return { org: o, feeEur: r.feeEur, monthEur: r.month.eur, roi: r.roi, openRequests: open.n, waitingOnCustomer: waiting.n };
    }),
  );
}

export async function openRequests(db: Db) {
  return db
    .select({ request: customerRequests, company: organizations.name })
    .from(customerRequests)
    .innerJoin(organizations, eq(organizations.id, customerRequests.orgId))
    .where(sql`${customerRequests.status} <> 'done'`)
    .orderBy(asc(customerRequests.createdAt));
}

export async function answerRequest(db: Db, actor: Actor, id: string, reply: string, status: "in_progress" | "done") {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(customerRequests).where(eq(customerRequests.id, id));
    if (!before) throw notFound("request");
    const [after] = await tx.update(customerRequests).set({ reply: reply.trim().slice(0, 4000) || before.reply, status }).where(eq(customerRequests.id, id)).returning();
    await audit(tx, actor, "customer_request.answered", { type: "customer_request", id }, { status: before.status, reply: before.reply }, { status, reply: after.reply });
    return after;
  });
}

export const goalInput = z.object({
  orgId: z.string().uuid(),
  metric: z.string().min(2).max(40),
  title: z.record(z.string(), z.string().min(2).max(200)),
  baseline: z.number(),
  target: z.number(),
  unit: z.string().max(20),
  due: z.coerce.date().optional(),
});

export async function addGoal(db: Db, actor: Actor, input: z.infer<typeof goalInput>) {
  const v = goalInput.parse(input);
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(goals).values({ ...v, current: v.baseline }).returning();
    await audit(tx, actor, "goal.added", { type: "goal", id: row.id }, null, v);
    return row;
  });
}

export async function setGoalCurrent(db: Db, actor: Actor, orgId: string, id: string, current: number) {
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(goals).where(and(eq(goals.id, id), eq(goals.orgId, orgId)));
    if (!before) throw notFound("goal");
    await tx.update(goals).set({ current }).where(eq(goals.id, id));
    await audit(tx, actor, "goal.measured", { type: "goal", id }, { current: before.current }, { current });
  });
}
