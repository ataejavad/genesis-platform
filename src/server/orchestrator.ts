import { desc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { jobRuns } from "@/db/schema";
import { checkBudgets } from "./agents";
import { ensurePartnerContracts } from "./contracts";
import { planEnv } from "./crm";
import { dailyReport } from "./daily-report";
import { billSubscriptions, dunning } from "./finance";
import { customerHealthWeek, monthlyResults } from "./health";
import { checkExperiments } from "./improve";
import { leadReminders } from "./lead-reminders";
import type { Mailer } from "./mailer";
import { opsWatch } from "./ops-watch";
import { sendDueEmails, startDueAiCalls } from "./outreach";
import { deliveryWatch } from "./projects";
import { retention } from "./retention";
import type { TelegramConfig } from "./telegram";
import type { VoiceCaller } from "./voice";

/*
 * Orchestrator (step 9): one list of every recurring job, when it runs and what it did (job_runs). The worker
 * and local mode both call runDue() in their loop; nothing else keeps its own timer. Calendar times are Rome
 * time. A job that fails is retried on the next loop after 15 minutes and shows red in Cockpit › Today.
 */

export type JobDeps = { mailer: Mailer | null; voice: VoiceCaller | null; telegram: TelegramConfig | null };
type Schedule = { every: number } | { daily: string } | { weekly: number; at: string } | { monthly: number; at: string };
export type JobDef = { id: string; what: string; schedule: Schedule; run: (db: Db, deps: JobDeps, now: Date) => Promise<unknown> };

export const JOBS: JobDef[] = [
  { id: "outreach.send", what: "Approved emails that are due; AI calls where switched on", schedule: { every: 10 }, run: async (db, d) => ({ emails: d.mailer ? await sendDueEmails(db, d.mailer) : "no mailer", calls: d.voice ? await startDueAiCalls(db, d.voice, planEnv()) : "no voice" }) },
  { id: "delivery.watch", what: "Milestones waiting on the customer, project health", schedule: { every: 60 }, run: (db, _d, now) => deliveryWatch(db, now) },
  { id: "ops.watch", what: "Work that stopped moving (process auditor at run time)", schedule: { every: 60 }, run: async (db, _d, now) => { const { items: _items, ...r } = await opsWatch(db, now); return r; } },
  { id: "money", what: "Monthly fees, payment reminders, partner framework contracts", schedule: { every: 60 }, run: async (db) => ({ billed: await billSubscriptions(db), dunning: await dunning(db), contracts: await ensurePartnerContracts(db) }) },
  { id: "agents.budget", what: "Pause agents over their monthly budget", schedule: { every: 60 }, run: (db, _d, now) => checkBudgets(db, now) },
  { id: "lead.reminders", what: "Deadline reminders the hub leads asked for (30 days before)", schedule: { daily: "07:00" }, run: (db, _d, now) => leadReminders(db, now) },
  { id: "experiments", what: "Close experiment windows; mark winners ready for Javad", schedule: { daily: "07:30" }, run: (db, _d, now) => checkExperiments(db, now) },
  { id: "daily.report", what: "Javad's morning brief (Telegram + Cockpit › Today)", schedule: { daily: "08:00" }, run: async (db, d, now) => { const r = await dailyReport(db, now, d.telegram); return { verdict: r.verdict, sent: Boolean(r.sentAt) }; } },
  { id: "customer.health", what: "Weekly health score per customer; at-risk alert", schedule: { weekly: 1, at: "07:00" }, run: (db, _d, now) => customerHealthWeek(db, now) },
  { id: "results.monthly", what: "Each customer's results of last month by email", schedule: { monthly: 1, at: "09:00" }, run: (db, _d, now) => monthlyResults(db, now) },
  { id: "data.retention", what: "Delete data past its retention period (GDPR)", schedule: { monthly: 1, at: "03:00" }, run: (db, _d, now) => retention(db, now) },
];

const RETRY_MS = 15 * 60_000;
const TZ = "Europe/Rome";

/* ───────────── Rome calendar ───────────── */

const parts = (d: Date) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" }).formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday) };
};
/** Rome wall-clock date + time → the instant (two passes settle the DST offset). */
export function romeInstant(date: string, time: string) {
  const want = Date.parse(`${date}T${time}:00Z`);
  let t = want;
  for (let i = 0; i < 2; i++) {
    const p = parts(new Date(t));
    t += want - Date.parse(`${p.date}T${p.time}:00Z`);
  }
  return new Date(t);
}
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
export const romeDay = (d: Date) => parts(d).date;

/** The most recent moment this calendar job was meant to run (null for interval jobs). */
export function lastSlot(s: Schedule, now: Date): Date | null {
  if ("every" in s) return null;
  const n = parts(now);
  if ("daily" in s) return romeInstant(n.time >= s.daily ? n.date : addDays(n.date, -1), s.daily);
  if ("weekly" in s) {
    let back = (n.dow - s.weekly + 7) % 7;
    if (back === 0 && n.time < s.at) back = 7;
    return romeInstant(addDays(n.date, -back), s.at);
  }
  const [y, m, d] = n.date.split("-").map(Number);
  const thisMonth = `${y}-${String(m).padStart(2, "0")}-${String(s.monthly).padStart(2, "0")}`;
  if (d > s.monthly || (d === s.monthly && n.time >= s.at)) return romeInstant(thisMonth, s.at);
  const prev = new Date(Date.UTC(y, m - 2, s.monthly)).toISOString().slice(0, 10);
  return romeInstant(prev, s.at);
}

/** Due when the slot passed after the last run; a failed run is retried after 15 minutes. A fresh install only catches up on the last 12 hours. */
export function isDue(job: JobDef, last: { startedAt: Date; ok: boolean | null } | undefined, now: Date) {
  if (last && last.ok === false && now.getTime() - last.startedAt.getTime() >= RETRY_MS) return true;
  if ("every" in job.schedule) return !last || now.getTime() - last.startedAt.getTime() >= job.schedule.every * 60_000;
  const slot = lastSlot(job.schedule, now)!;
  if (!last) return now.getTime() - slot.getTime() <= 12 * 36e5;
  return last.startedAt < slot;
}

/* ───────────── Running ───────────── */

export async function lastRuns(db: Db) {
  const out = new Map<string, typeof jobRuns.$inferSelect>();
  for (const j of JOBS) {
    const [r] = await db.select().from(jobRuns).where(eq(jobRuns.job, j.id)).orderBy(desc(jobRuns.startedAt)).limit(1);
    if (r) out.set(j.id, r);
  }
  return out;
}

/** Runs every job that is due, one after the other; one failing job never stops the others. */
export async function runDue(db: Db, deps: JobDeps, now = new Date(), only?: string[]) {
  const last = await lastRuns(db);
  const ran: { job: string; ok: boolean }[] = [];
  for (const job of JOBS) {
    if (only ? !only.includes(job.id) : !isDue(job, last.get(job.id), now)) continue;
    ran.push({ job: job.id, ok: await runJob(db, deps, job, now) });
  }
  return ran;
}

export async function runJob(db: Db, deps: JobDeps, job: JobDef, now = new Date()) {
  const [row] = await db.insert(jobRuns).values({ job: job.id, startedAt: now }).returning({ id: jobRuns.id });
  try {
    const result = await job.run(db, deps, now);
    await db.update(jobRuns).set({ finishedAt: new Date(), ok: true, result: result ?? null }).where(eq(jobRuns.id, row.id));
    return true;
  } catch (err) {
    console.error(`job ${job.id} failed:`, err);
    await db.update(jobRuns).set({ finishedAt: new Date(), ok: false, error: err instanceof Error ? err.message.slice(0, 500) : String(err) }).where(eq(jobRuns.id, row.id));
    return false;
  }
}

/** Javad's "run now" button in the cockpit. */
export async function runNow(db: Db, deps: JobDeps, id: string) {
  const job = JOBS.find((j) => j.id === id);
  if (!job) throw new Error(`unknown job ${id}`);
  return runJob(db, deps, job);
}

/** The board for Cockpit › Today: every job, its schedule, last run and next due. */
export async function jobBoard(db: Db, now = new Date()) {
  const last = await lastRuns(db);
  return JOBS.map((j) => {
    const r = last.get(j.id);
    const s = j.schedule;
    const when = "every" in s ? `every ${s.every} min` : "daily" in s ? `daily ${s.daily}` : "weekly" in s ? `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][s.weekly]} ${s.at}` : `day ${s.monthly} ${s.at}`;
    return { id: j.id, what: j.what, when, lastAt: r?.startedAt ?? null, ok: r?.ok ?? null, error: r?.error ?? null, result: r?.result ?? null, due: isDue(j, r, now) };
  });
}
