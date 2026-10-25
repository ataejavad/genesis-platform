import { and, desc, eq, gte, sql, sum } from "drizzle-orm";
import { AGENTS } from "@/config/agents";
import type { Db } from "@/db";
import { approvals, experiments, invoices, leads, orders, prospects, reports, subscriptions, touches } from "@/db/schema";
import { agentBoard, monthSpend } from "./agents";
import { latestHealth } from "./health";
import { type OpsItem, opsWatch } from "./ops-watch";
import { sendAlert, type TelegramConfig } from "./telegram";

/*
 * Javad's morning brief (step 9, reporting rule 2026-10-22): verdict first, five numbers, what is stuck, what
 * needs his decision. At most 5 items per list, about 200 words, readable in a minute. Stored in `reports`
 * (Cockpit › Today) and sent to Telegram. Stuck items come from the ops watchdog, not a second collector.
 */

const DAY = 864e5;
const MAX = 5;
// money and broken plumbing first; then people waiting on us
const PRIORITY = ["payout", "system", "contract", "order", "request", "qa", "input", "late", "no_match", "approval", "application", "document"];

export type Brief = {
  verdict: string;
  level: "green" | "yellow" | "red";
  numbers: { label: string; value: string }[];
  stuck: { text: string; link: string }[];
  stuckMore: number;
  decisions: { text: string; link: string }[];
  decisionsMore: number;
};

export async function buildBrief(db: Db, now = new Date()): Promise<Brief> {
  const since = new Date(now.getTime() - DAY);
  const count = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
  const n = sql<number>`count(*)::int`;
  const newLeads = await count(db.select({ n }).from(leads).where(gte(leads.createdAt, since)));
  const replies = await count(db.select({ n }).from(prospects).where(gte(prospects.repliedAt, since)));
  const newOrders = await count(db.select({ n }).from(orders).where(gte(orders.createdAt, since)));
  const [cash] = await db.select({ eur: sum(invoices.totalEur) }).from(invoices).where(gte(invoices.paidAt, since));
  const [mrr] = await db.select({ eur: sum(subscriptions.monthlyEur) }).from(subscriptions).where(eq(subscriptions.status, "active"));
  const spend = await monthSpend(db, now);
  const budget = AGENTS.reduce((s, a) => s + a.budgetEur, 0);

  const ops = await opsWatch(db, now);
  const stuckAll = [...ops.items].sort((a: OpsItem, b: OpsItem) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind));

  const decisions: { text: string; link: string }[] = [];
  const pendingApprovals = await count(db.select({ n }).from(approvals).where(eq(approvals.status, "pending")));
  if (pendingApprovals) decisions.push({ text: `${pendingApprovals} draft(s) to approve before they go public`, link: "/cockpit/approvals" });
  const drafts = await count(db.select({ n }).from(touches).where(eq(touches.status, "draft")));
  if (drafts) decisions.push({ text: `${drafts} outreach message(s) wait for your OK`, link: "/cockpit/outreach" });
  for (const e of await db.select().from(experiments).where(eq(experiments.status, "ready"))) {
    const r = e.result as { winner?: string; why?: string } | null;
    decisions.push({ text: `Test "${e.key}" finished: ${r?.why ?? ""}. Adopt ${r?.winner}?`, link: "/cockpit/experiments" });
  }
  const board = await agentBoard(db, now);
  for (const a of board) {
    if (a.decision) decisions.push({ text: a.decision, link: "/cockpit/agents" });
    if (a.paused) decisions.push({ text: `${a.def.name} paused: €${a.spentEur} of €${a.budgetEur} spent. Raise the budget or wait for the 1st`, link: "/cockpit/agents" });
  }
  for (const h of (await latestHealth(db)).filter((x) => x.h.band === "red")) {
    const why = (h.h.signals as { reasons?: string[] }).reasons?.[0] ?? "";
    decisions.push({ text: `${h.name} at risk (${h.h.score}/100): ${why}`, link: "/cockpit/customers" });
  }

  const urgent = stuckAll.some((i) => i.kind === "payout" || i.kind === "system");
  const level: Brief["level"] = urgent ? "red" : stuckAll.length || decisions.length ? "yellow" : "green";
  const verdict =
    level === "red"
      ? `Act now: ${stuckAll.filter((i) => i.kind === "payout" || i.kind === "system").length} urgent item(s) (money or a broken process)`
      : level === "yellow"
        ? `${decisions.length} decision(s) for you, ${stuckAll.length} item(s) stuck`
        : "All running on its own; nothing needs you today";
  const eur = (v: unknown) => `€${Math.round(Number(v ?? 0)).toLocaleString("en-GB")}`;
  return {
    verdict,
    level,
    numbers: [
      { label: "New leads (24h)", value: String(newLeads) },
      { label: "Replies (24h)", value: String(replies) },
      { label: "Orders (24h)", value: String(newOrders) },
      { label: "Cash in (24h) · monthly fees", value: `${eur(cash?.eur)} · ${eur(mrr?.eur)}` },
      { label: "AI spend this month", value: `${eur(spend)} of ${eur(budget)}` },
    ],
    stuck: stuckAll.slice(0, MAX).map((i) => ({ text: i.text, link: i.link })),
    stuckMore: Math.max(0, stuckAll.length - MAX),
    decisions: decisions.slice(0, MAX),
    decisionsMore: Math.max(0, decisions.length - MAX),
  };
}

export function briefText(b: Brief) {
  const icon = { green: "🟢", yellow: "🟡", red: "🔴" }[b.level];
  const lines = [`${icon} ${b.verdict}`, "", ...b.numbers.map((x) => `${x.label}: ${x.value}`)];
  if (b.decisions.length) lines.push("", "Your decisions:", ...b.decisions.map((d) => `• ${d.text}`), ...(b.decisionsMore ? [`… +${b.decisionsMore}`] : []));
  if (b.stuck.length) lines.push("", "Stuck:", ...b.stuck.map((s) => `• ${s.text}`), ...(b.stuckMore ? [`… +${b.stuckMore}`] : []));
  return lines.join("\n");
}

/** Builds today's brief (Rome day), stores it and sends it once. Running it again the same day refreshes it. */
export async function dailyReport(db: Db, now = new Date(), telegram: TelegramConfig | null = null) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(now);
  const brief = await buildBrief(db, now);
  const text = briefText(brief);
  const [row] = await db
    .insert(reports)
    .values({ kind: "daily", day, verdict: brief.verdict, body: brief, text })
    .onConflictDoUpdate({ target: [reports.kind, reports.day], set: { verdict: brief.verdict, body: brief, text } })
    .returning();
  if (telegram && !row.sentAt) {
    await sendAlert(telegram, text.split("\n"), "/cockpit");
    const [sent] = await db.update(reports).set({ sentAt: new Date() }).where(eq(reports.id, row.id)).returning();
    return sent;
  }
  return row;
}

export async function latestReport(db: Db, kind = "daily") {
  const [r] = await db.select().from(reports).where(and(eq(reports.kind, kind))).orderBy(desc(reports.createdAt)).limit(1);
  return r ?? null;
}
