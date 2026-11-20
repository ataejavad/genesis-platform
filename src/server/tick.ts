import { randomUUID } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import type { Db } from "@/db";
import { leases } from "@/db/schema";
import { dispatchBatch, type DispatchDeps } from "@/worker/dispatch";
import { adminChatFromEnv } from "./admin-chat";
import { mailerFromEnv } from "./mailer";
import { sendQueued } from "./notify";
import { type JobDeps, runDue } from "./orchestrator";
import { isStopped } from "./switches";
import { voiceFromEnv } from "./voice";

/*
 * One pass of the background worker, for hosts without an always-on process (Vercel):
 * drain the event outbox, send queued emails, and (from the cron) run the orchestrator's due jobs.
 * A lease in the database makes sure only one pass runs at a time, so no email goes out twice.
 * The always-on worker (src/worker/index.ts) does the same in a loop.
 */
export type TickDeps = DispatchDeps & JobDeps;

export function tickDepsFromEnv(): TickDeps {
  const adminChat = adminChatFromEnv();
  return { adminChat, n8nWebhookUrl: process.env.N8N_EVENTS_WEBHOOK_URL || undefined, mailer: mailerFromEnv(), voice: voiceFromEnv() };
}

/** Takes the named lease for `ms` unless someone else holds it; returns the holder id or null. */
export async function takeLease(db: Db, name: string, ms: number, now = new Date()) {
  const holder = randomUUID();
  const until = new Date(now.getTime() + ms);
  const rows = await db
    .insert(leases)
    .values({ name, until, holder })
    .onConflictDoUpdate({ target: leases.name, set: { until, holder }, setWhere: lt(leases.until, now) })
    .returning({ holder: leases.holder });
  return rows[0]?.holder === holder ? holder : null;
}

export async function releaseLease(db: Db, name: string, holder: string) {
  await db.delete(leases).where(and(eq(leases.name, name), eq(leases.holder, holder)));
}

export async function runTick(db: Db, deps: TickDeps, opts: { jobs: boolean; budgetMs: number }) {
  const started = Date.now();
  // the lease outlives the budget a little, so a crashed pass frees it on its own
  const holder = await takeLease(db, "tick", opts.budgetMs + 30_000);
  if (!holder) return { skipped: true as const };
  const out = { skipped: false as const, jobs: [] as { job: string; ok: boolean }[], events: 0, emails: 0 };
  try {
    if (opts.jobs) out.jobs = await runDue(db, deps);
    while (Date.now() - started < opts.budgetMs) {
      const n = await dispatchBatch(db, deps);
      const m = deps.mailer && !(await isStopped(db)) ? await sendQueued(db, deps.mailer) : 0;
      out.events += n;
      out.emails += m;
      if (n === 0 && m === 0) break;
    }
  } finally {
    await releaseLease(db, "tick", holder);
  }
  return out;
}
