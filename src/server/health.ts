import { and, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { customerApprovals, customerHealth, customerRequests, invoices, organizations, portalMessages, portalThreads, projects, subscriptions } from "@/db/schema";
import type { Actor } from "./actor";
import { emit } from "./events";
import { askCustomerApproval, results } from "./portal";

/*
 * Customer health (step 9): every Monday a 0–100 score per paying customer from what they do, not what they say.
 * Red (< 40) goes to Javad at once and into the daily brief; the reasons say what to do. On the 1st, every customer
 * gets last month's results against the fee (sell results, not tools).
 */

const DAY = 864e5;
export const HEALTH = { red: 40, watch: 70 };

/** ISO week key, e.g. 2026-W43. */
export function weekKey(d: Date) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / DAY + 1) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
}

/** Paying or in delivery: an active subscription or a running project. */
async function activeCustomers(db: Db) {
  const orgs = await db.select().from(organizations).where(eq(organizations.kind, "customer"));
  const subs = await db.select({ orgId: subscriptions.orgId }).from(subscriptions).where(eq(subscriptions.status, "active"));
  const running = await db.select({ orgId: projects.orgId }).from(projects).where(inArray(projects.status, ["running", "delivered"]));
  const ids = new Set([...subs.map((s) => s.orgId), ...running.map((p) => p.orgId)]);
  return orgs.filter((o) => ids.has(o.id));
}

export type HealthSignals = { valueVsFee: number | null; activeDays14: number; overdueInvoices: number; waitingApprovals: number; openRequests: number; reasons: string[] };

/** Score = results (35) + use (25) + money (20) + waiting on them (10) + waiting on us (10). */
export async function scoreCustomer(db: Db, orgId: string, now = new Date()) {
  const r = await results(db, orgId, now);
  // early in the month the last full month speaks for the results
  const eur = now.getUTCDate() < 10 ? Math.max(r.month.eur, r.lastMonth.eur) : r.month.eur;
  const valueVsFee = r.feeEur ? Math.round((eur / r.feeEur) * 10) / 10 : null;
  const [use] = await db.select({ days: sql<number>`count(distinct date_trunc('day', ${portalMessages.createdAt}))::int` }).from(portalMessages).innerJoin(portalThreads, eq(portalThreads.id, portalMessages.threadId)).where(and(eq(portalThreads.orgId, orgId), eq(portalMessages.role, "user"), gte(portalMessages.createdAt, new Date(now.getTime() - 14 * DAY))));
  const [late] = await db.select({ n: sql<number>`count(*)::int` }).from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.status, "requested"), lt(invoices.dueAt, now)));
  const [waiting] = await db.select({ n: sql<number>`count(*)::int` }).from(customerApprovals).where(and(eq(customerApprovals.orgId, orgId), eq(customerApprovals.status, "pending"), lt(customerApprovals.createdAt, new Date(now.getTime() - 7 * DAY))));
  const [open] = await db.select({ n: sql<number>`count(*)::int` }).from(customerRequests).where(and(eq(customerRequests.orgId, orgId), eq(customerRequests.status, "open"), lt(customerRequests.createdAt, new Date(now.getTime() - 2 * DAY))));

  const reasons: string[] = [];
  // results: no fee yet (project phase) counts as half
  const resultPts = valueVsFee === null ? 18 : valueVsFee >= 2 ? 35 : valueVsFee >= 1 ? 28 : valueVsFee > 0 ? 15 : 0;
  if (valueVsFee !== null && valueVsFee < 1) reasons.push(`results €${eur} below the fee €${r.feeEur}: show or fix the result`);
  const usePts = use.days >= 3 ? 25 : use.days >= 1 ? 15 : 0;
  if (!use.days) reasons.push("no use of the dashboard in 14 days: call them");
  const moneyPts = late.n ? 0 : 20;
  if (late.n) reasons.push(`${late.n} payment(s) overdue`);
  const waitPts = waiting.n ? 0 : 10;
  if (waiting.n) reasons.push(`${waiting.n} approval(s) waiting on them > 7 days`);
  const usPts = open.n ? 0 : 10;
  if (open.n) reasons.push(`${open.n} request(s) unanswered by us > 2 days`);
  const score = resultPts + usePts + moneyPts + waitPts + usPts;
  const band = score < HEALTH.red ? "red" : score < HEALTH.watch ? "watch" : "green";
  return { score, band, signals: { valueVsFee, activeDays14: use.days, overdueInvoices: late.n, waitingApprovals: waiting.n, openRequests: open.n, reasons } satisfies HealthSignals };
}

/** Weekly: one score per customer and week; turning red alerts Javad once. */
export async function customerHealthWeek(db: Db, now = new Date()) {
  const week = weekKey(now);
  const actor: Actor = { type: "system", id: "customer-health" };
  const out = { scored: 0, red: 0, watch: 0 };
  for (const o of await activeCustomers(db)) {
    const h = await scoreCustomer(db, o.id, now);
    const [prev] = await db.select({ band: customerHealth.band }).from(customerHealth).where(and(eq(customerHealth.orgId, o.id), lte(customerHealth.week, week))).orderBy(sql`${customerHealth.week} desc`).limit(1);
    await db.transaction(async (tx) => {
      await tx.insert(customerHealth).values({ orgId: o.id, week, score: h.score, band: h.band, signals: h.signals }).onConflictDoUpdate({ target: [customerHealth.orgId, customerHealth.week], set: { score: h.score, band: h.band, signals: h.signals } });
      if (h.band === "red" && prev?.band !== "red") await emit(tx, actor, "customer.at_risk", { type: "organization", id: o.id }, { orgId: o.id, company: o.name, score: h.score, reasons: h.signals.reasons });
    });
    out.scored++;
    if (h.band === "red") out.red++;
    if (h.band === "watch") out.watch++;
  }
  return out;
}

/** The newest score of each customer (cockpit and brief). */
export async function latestHealth(db: Db) {
  const rows = await db.select({ h: customerHealth, name: organizations.name }).from(customerHealth).innerJoin(organizations, eq(organizations.id, customerHealth.orgId)).orderBy(sql`${customerHealth.week} desc`);
  const seen = new Set<string>();
  return rows.filter((r) => !seen.has(r.h.orgId) && seen.add(r.h.orgId));
}

/** Monthly on the 1st: last month's results against the fee, one event per customer (the email is queued from it). */
export async function monthlyResults(db: Db, now = new Date()) {
  const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 1);
  const month = lastDay.toISOString().slice(0, 7);
  const actor: Actor = { type: "system", id: "monthly-results" };
  let sent = 0;
  for (const o of await activeCustomers(db)) {
    const r = await results(db, o.id, lastDay);
    if (!r.feeEur && !r.month.eur) continue;
    // one report per customer and month, also when the job runs twice
    const [dup] = await db.execute(sql`select 1 from events where type = 'results.reported' and subject_id = ${o.id} and payload->>'month' = ${month} limit 1`) as unknown as unknown[];
    if (dup) continue;
    await db.transaction((tx) => emit(tx, actor, "results.reported", { type: "organization", id: o.id }, { orgId: o.id, month, eur: r.month.eur, feeEur: r.feeEur, roi: r.roi, sinceStartEur: r.sinceStart.eur }));
    sent++;
  }
  return { month, sent };
}

/* ───────────── After a project: story and referral ───────────── */

const STORY: Record<string, { title: string; detail: string }> = {
  it: { title: "Possiamo raccontare il vostro risultato?", detail: "Il progetto {code} è concluso. Ci permettete di raccontarlo come caso di successo (anche senza il vostro nome)? E se conoscete un'altra azienda a cui servirebbe, scriveteci il nome nella chat." },
  de: { title: "Dürfen wir über Ihr Ergebnis berichten?", detail: "Das Projekt {code} ist abgeschlossen. Dürfen wir es als Erfolgsgeschichte zeigen (auch ohne Ihren Namen)? Und wenn Sie ein anderes Unternehmen kennen, dem das helfen würde, nennen Sie es uns im Chat." },
  fa: { title: "اجازه می‌دهید نتیجه‌تان را تعریف کنیم؟", detail: "پروژه {code} تمام شد. اجازه می‌دهید آن را به‌عنوان نمونه موفق نشان دهیم (حتی بدون نام شما)؟ اگر شرکت دیگری را می‌شناسید که به این نیاز دارد، نامش را در چت بنویسید." },
  en: { title: "May we tell others about your result?", detail: "Project {code} is finished. May we show it as a success story (without your name if you prefer)? And if you know another company that needs this, tell us its name in the chat." },
};

/** project.closed → one approval card in the customer's dashboard (accepted = case study allowed; Javad is told). */
export async function askForStory(db: Db, projectId: string) {
  const [p] = await db.select({ orgId: projects.orgId, code: projects.code }).from(projects).where(eq(projects.id, projectId));
  if (!p?.orgId) return null;
  const [org] = await db.select({ locale: organizations.locale }).from(organizations).where(eq(organizations.id, p.orgId));
  const t = STORY[(org?.locale ?? "en").slice(0, 2)] ?? STORY.en;
  const [asked] = await db.select({ id: customerApprovals.id }).from(customerApprovals).where(and(eq(customerApprovals.orgId, p.orgId), eq(customerApprovals.title, t.title)));
  if (asked) return null;
  return askCustomerApproval(db, { type: "system", id: "customer-success" }, { orgId: p.orgId, title: t.title, detail: t.detail.replace("{code}", p.code) });
}
