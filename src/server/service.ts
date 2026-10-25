import { and, eq, gt, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { LOSS_REASONS, type LossReason } from "@/config/loss-reasons";
import type { Db, DbOrTx, Tx } from "@/db";
import { events, jobs, lessons, organizations, orders, servicePackages, serviceCosts, subscriptions } from "@/db/schema";
import type { Actor } from "./actor";
import { customerCode } from "./delivery-rules";
import { AppError, notFound } from "./errors";
import { audit, emit } from "./events";
import { addLesson } from "./improve";
import { SKILLS } from "./partner-rules";
import { approvedVersion } from "./projects";

/*
 * The monthly service (gap audit 2026-10-25b): what the monthly fee delivers after go-live, what it costs us and
 * why customers leave. Each month every running subscription gets its package's check-up tasks (partner jobs on a
 * protocol, like project tasks) and its expected running costs; the customer hears when a check is done. Actual
 * costs replace estimates of the same line, so the cockpit shows the real margin per customer.
 */

const DAY = 864e5;
const by = (a: Actor) => `${a.type}:${a.id}`;
export const NOTICE_DAYS = 30; // contract IT-2026.2: the customer cancels from the dashboard with 30 days' notice
export const MARGIN_FLOOR = 40; // % of the fee; below it the customer shows red and ops-watch flags it
export { LOSS_REASONS, type LossReason };
const LESSON_AT = 3; // the same reason this often in 30 days becomes a sales lesson

export const periodOf = (d: Date) => d.toISOString().slice(0, 7);
const periodStart = (period: string) => new Date(`${period}-01T00:00:00Z`);

/** Subscriptions that run in this month: started before it, and not ended before it starts. */
async function runningIn(db: DbOrTx, period: string) {
  const start = periodStart(period);
  return db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.status, "active"), lte(subscriptions.startedAt, start), or(isNull(subscriptions.endsAt), gt(subscriptions.endsAt, start))));
}

/** Monthly job (day 1): the check-up tasks and expected costs of every running subscription, once per month. */
export async function monthlyService(db: Db, now = new Date()) {
  const actor: Actor = { type: "system", id: "monthly-service" };
  const period = periodOf(now);
  const start = periodStart(period);
  const pkgs = new Map((await db.select().from(servicePackages)).map((p) => [p.slug, p]));
  let jobsOpened = 0;
  const noProtocol: string[] = [];
  for (const s of await runningIn(db, period)) {
    const pkg = pkgs.get(s.product);
    if (!pkg || (!pkg.monthly.tasks.length && !pkg.monthly.costs.length)) continue;
    await db.transaction(async (tx) => {
      const [done] = await tx.select({ id: serviceCosts.id }).from(serviceCosts).where(and(eq(serviceCosts.subscriptionId, s.id), eq(serviceCosts.period, period))).limit(1);
      if (done) return;
      const [org] = await tx.select().from(organizations).where(eq(organizations.id, s.orgId));
      if (!org) return;
      const lang = org.locale ?? "en";
      for (const t of pkg.monthly.tasks) {
        const pv = (await approvedVersion(tx, t.protocol))?.version;
        if (!pv) {
          noProtocol.push(`${pkg.slug}:${t.protocol}`);
          continue;
        }
        const brief = [t.brief, "", `Goal: ${pv.goal}`, `Deliver: ${pv.deliverables.join("; ")}`, `Rules: ${pv.rules.join(" ")}`].join("\n");
        const [j] = await tx
          .insert(jobs)
          .values({
            title: `${t.title} · ${period}`, brief, kind: "customer", customerOrgId: org.id, customerCode: customerCode(org.id, org.industry, org.country),
            skills: t.skills.filter((x) => SKILLS.some((k) => k.id === x)), language: lang, country: org.country, personalData: pkg.personalData, payEur: t.payEur,
            dueAt: new Date(start.getTime() + t.day * DAY), checklist: pv.criteria.map((c) => c.texts?.[lang] ?? c.text), protocolVersionId: pv.id,
            subscriptionId: s.id, period, createdBy: by(actor),
          })
          .returning();
        await tx.insert(serviceCosts).values({ orgId: org.id, subscriptionId: s.id, period, kind: "partner", label: t.title, amountEur: t.payEur, source: "estimate", jobId: j.id, createdBy: by(actor) }).onConflictDoNothing();
        // the worker offers it to the best partners, like any opened task
        await emit(tx, actor, "job.opened", { type: "job", id: j.id }, { subscriptionId: s.id, period, role: "monthly", title: j.title });
        jobsOpened++;
      }
      for (const c of pkg.monthly.costs) await tx.insert(serviceCosts).values({ orgId: org.id, subscriptionId: s.id, period, kind: c.kind, label: c.label, amountEur: c.eur, source: "estimate", createdBy: by(actor) }).onConflictDoNothing();
      await audit(tx, actor, "service.planned", { type: "subscription", id: s.id }, null, { period, tasks: pkg.monthly.tasks.length, costs: pkg.monthly.costs.length });
    });
  }
  return { period, jobs: jobsOpened, noProtocol };
}

/** Called from onJobAccepted for a monthly check-up: the partner's real cost is booked and the customer is told. */
export async function serviceJobDone(tx: Tx, actor: Actor, job: typeof jobs.$inferSelect, now: Date) {
  if (!job.subscriptionId || !job.period || !job.customerOrgId) return;
  const [s] = await tx.select().from(subscriptions).where(eq(subscriptions.id, job.subscriptionId));
  if (!s) return;
  const label = job.title.replace(/ · \d{4}-\d{2}$/, "");
  await tx.insert(serviceCosts).values({ orgId: s.orgId, subscriptionId: s.id, period: job.period, kind: "partner", label, amountEur: job.payEur, source: "actual", jobId: job.id, createdBy: by(actor) }).onConflictDoNothing();
  const [pkg] = await tx.select().from(servicePackages).where(eq(servicePackages.slug, s.product));
  const [org] = await tx.select({ locale: organizations.locale }).from(organizations).where(eq(organizations.id, s.orgId));
  const task = pkg?.monthly.tasks.find((t) => t.title === label);
  const title = task?.titles?.[org?.locale ?? "en"] ?? label;
  await emit(tx, actor, "service.checked", { type: "subscription", id: s.id }, { orgId: s.orgId, period: job.period, title, product: pkg?.titles[org?.locale ?? "en"] ?? pkg?.title ?? s.product, at: now.toISOString() });
}

const costInput = z.object({ subscriptionId: z.string().uuid(), period: z.string().regex(/^\d{4}-\d{2}$/), label: z.string().trim().min(2).max(120), kind: z.enum(["partner", "tool", "usage", "other"]), amountEur: z.number().min(0).max(100000) });

/** A real cost (a bill for voice minutes, a tool invoice): replaces the estimate of the same line in that month. */
export async function recordCost(db: Db, actor: Actor, input: z.input<typeof costInput>) {
  const v = costInput.parse(input);
  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(subscriptions).where(eq(subscriptions.id, v.subscriptionId));
    if (!s) throw notFound("subscription");
    const [row] = await tx
      .insert(serviceCosts)
      .values({ orgId: s.orgId, ...v, source: "actual", createdBy: by(actor) })
      .onConflictDoUpdate({ target: [serviceCosts.subscriptionId, serviceCosts.period, serviceCosts.label, serviceCosts.source], set: { amountEur: v.amountEur, kind: v.kind, createdBy: by(actor) } })
      .returning();
    await emit(tx, actor, "service.cost_recorded", { type: "subscription", id: s.id }, { orgId: s.orgId, period: v.period, label: v.label, amountEur: v.amountEur });
    await audit(tx, actor, "service.cost_recorded", { type: "service_cost", id: row.id }, null, v);
    return row;
  });
}

export type Margin = { orgId: string; feeEur: number; costEur: number; marginEur: number; marginPct: number | null; estimated: boolean; lines: { label: string; kind: string; eur: number; source: string }[] };

/** Fee minus cost per customer in a month; an actual line replaces its estimate. */
export async function margins(db: DbOrTx, period: string): Promise<Map<string, Margin>> {
  const subs = await runningIn(db, period);
  const rows = subs.length ? await db.select().from(serviceCosts).where(and(eq(serviceCosts.period, period), inArray(serviceCosts.subscriptionId, subs.map((s) => s.id)))) : [];
  const out = new Map<string, Margin>();
  for (const s of subs) {
    const m = out.get(s.orgId) ?? { orgId: s.orgId, feeEur: 0, costEur: 0, marginEur: 0, marginPct: null, estimated: false, lines: [] };
    m.feeEur += s.monthlyEur;
    const mine = rows.filter((r) => r.subscriptionId === s.id);
    for (const r of mine) {
      if (r.source === "estimate" && mine.some((x) => x.source === "actual" && x.label === r.label)) continue;
      m.lines.push({ label: r.label, kind: r.kind, eur: r.amountEur, source: r.source });
      m.costEur += r.amountEur;
      if (r.source === "estimate") m.estimated = true;
    }
    out.set(s.orgId, m);
  }
  for (const m of out.values()) {
    m.costEur = Math.round(m.costEur * 100) / 100;
    m.marginEur = Math.round((m.feeEur - m.costEur) * 100) / 100;
    m.marginPct = m.feeEur ? Math.round((m.marginEur / m.feeEur) * 100) : null;
  }
  return out;
}

/** Customers under the margin floor this month (ops-watch, Systems KPI). */
export async function lowMargins(db: DbOrTx, now = new Date()) {
  return [...(await margins(db, periodOf(now))).values()].filter((m) => m.marginPct !== null && m.marginPct < MARGIN_FLOOR);
}

/* ───────────── Leaving: notice, reasons, lessons ───────────── */

/** The customer (dashboard) or Javad gives notice: billed until it ends, then it stops. The reason feeds the lessons. */
export async function cancelSubscription(db: Db, actor: Actor, orgId: string, subscriptionId: string, reason: string, note?: string, now = new Date()) {
  const r = z.enum(LOSS_REASONS).parse(reason);
  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(subscriptions).where(and(eq(subscriptions.id, subscriptionId), eq(subscriptions.orgId, orgId))).for("update");
    if (!s) throw notFound("subscription");
    if (s.status !== "active" || s.endsAt) throw new AppError(409, "already_cancelled", "notice already given");
    const endsAt = new Date(now.getTime() + NOTICE_DAYS * DAY);
    const [org] = await tx.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId));
    const [pkg] = await tx.select({ title: servicePackages.title }).from(servicePackages).where(eq(servicePackages.slug, s.product));
    await tx.update(subscriptions).set({ endsAt, cancelReason: r, cancelNote: note?.slice(0, 1000) || null }).where(eq(subscriptions.id, s.id));
    await emit(tx, actor, "subscription.cancelled", { type: "subscription", id: s.id }, { orgId, company: org?.name, product: pkg?.title ?? s.product, monthlyEur: s.monthlyEur, reason: r, note: note?.slice(0, 300) ?? null, endsAt: endsAt.toISOString() });
    await audit(tx, actor, "subscription.cancelled", { type: "subscription", id: s.id }, { endsAt: null }, { endsAt, reason: r, note });
    await recordLoss(tx, actor, "churn", r, now);
    return { endsAt };
  });
}

/** Javad won them back: the notice is withdrawn and the service runs on. */
export async function keepSubscription(db: Db, actor: Actor, subscriptionId: string, now = new Date()) {
  await db.transaction(async (tx) => {
    const [s] = await tx.select().from(subscriptions).where(eq(subscriptions.id, subscriptionId)).for("update");
    if (!s?.endsAt || s.endsAt <= now || s.status !== "active") throw notFound("notice");
    await tx.update(subscriptions).set({ endsAt: null }).where(eq(subscriptions.id, s.id));
    await emit(tx, actor, "subscription.kept", { type: "subscription", id: s.id }, { orgId: s.orgId, product: s.product, reason: s.cancelReason });
    await audit(tx, actor, "subscription.kept", { type: "subscription", id: s.id }, { endsAt: s.endsAt }, { endsAt: null });
  });
}

/** Notices that ran out: the subscription ends (no more fees, no more check-ups). */
export async function endSubscriptions(db: Db, now = new Date()) {
  const actor: Actor = { type: "system", id: "monthly-service" };
  return db.transaction(async (tx) => {
    const done = await tx.update(subscriptions).set({ status: "cancelled" }).where(and(eq(subscriptions.status, "active"), lte(subscriptions.endsAt, now))).returning();
    for (const s of done) {
      await emit(tx, actor, "subscription.ended", { type: "subscription", id: s.id }, { orgId: s.orgId, product: s.product, reason: s.cancelReason });
      await audit(tx, actor, "subscription.ended", { type: "subscription", id: s.id }, { status: "active" }, { status: "cancelled" });
    }
    return done.length;
  });
}

/** Customers who gave notice and are still with us: Javad's chance to call them. */
export async function notices(db: DbOrTx, now = new Date()) {
  return db
    .select({ s: subscriptions, company: organizations.name })
    .from(subscriptions)
    .innerJoin(organizations, eq(organizations.id, subscriptions.orgId))
    .where(and(eq(subscriptions.status, "active"), gt(subscriptions.endsAt, now)));
}

/**
 * Every lost customer, deal or order is recorded with its reason (event loss.recorded). The same reason three
 * times in 30 days becomes one sales lesson that the outreach and pricing agents read.
 */
export async function recordLoss(tx: DbOrTx, actor: Actor, kind: "churn" | "deal" | "order", reason: LossReason, now = new Date()) {
  await emit(tx, actor, "loss.recorded", { type: "loss", id: reason }, { kind, reason });
  const [{ n }] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.type, "loss.recorded"), sql`${events.payload}->>'reason' = ${reason}`, gte(events.createdAt, new Date(now.getTime() - 30 * DAY))));
  if (n < LESSON_AT || reason === "other") return;
  const source = `loss:${reason}:${periodOf(now)}`;
  const [had] = await tx.select({ id: lessons.id }).from(lessons).where(eq(lessons.source, source));
  if (had) return;
  await addLesson(tx, { area: "sales", text: `${n} customers, deals or orders lost for "${reason.replace("_", " ")}" in 30 days: ${LESSON_TEXT[reason]}`, source, evidence: { reason, n } });
}

const LESSON_TEXT: Record<LossReason, string> = {
  price: "show the result in euros next to the fee earlier, and offer the smaller first step.",
  timing: "ask when the problem hurts most and follow up then instead of pushing now.",
  fit: "qualify harder before the brief: trade, size and the exact problem.",
  competitor: "find out who won and why; compare on result and speed, not on price.",
  no_answer: "shorten the follow-up gap and try another channel before closing.",
  quality: "check the protocol and partner behind it; quality issues lose customers fastest.",
  other: "",
};

/** Javad rejects an order with a reason (step 8 orders; the reason counts like any loss). */
export async function orderLost(tx: Tx, actor: Actor, orderId: string, reason: string) {
  const r = z.enum(LOSS_REASONS).parse(reason);
  await tx.update(orders).set({ lostReason: r }).where(eq(orders.id, orderId));
  await recordLoss(tx, actor, "order", r);
}
