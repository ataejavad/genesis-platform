import { getDb } from "@/db";
import { telegramConfigFromEnv } from "@/server/telegram";
import { planEnv } from "@/server/crm";
import { ensurePartnerContracts } from "@/server/contracts";
import { billSubscriptions, dunning } from "@/server/finance";
import { mailerFromEnv } from "@/server/mailer";
import { sendQueued } from "@/server/notify";
import { sendDueEmails, startDueAiCalls } from "@/server/outreach";
import { opsWatch } from "@/server/ops-watch";
import { deliveryWatch } from "@/server/projects";
import { voiceFromEnv } from "@/server/voice";
import { dispatchBatch } from "./dispatch";

// Background worker: drains the event outbox. Runs as its own container next to the app.
const db = getDb();
const deps = { telegram: telegramConfigFromEnv(), n8nWebhookUrl: process.env.N8N_EVENTS_WEBHOOK_URL || undefined };
const mailer = mailerFromEnv();
const voice = voiceFromEnv();
let running = true;
let lastOutbox = 0;
let lastWatch = 0;

process.on("SIGTERM", () => (running = false));
process.on("SIGINT", () => (running = false));

console.log(`worker started (telegram: ${deps.telegram ? "on" : "off"}, n8n: ${deps.n8nWebhookUrl ? "on" : "off"})`);
while (running) {
  try {
    // Outbox every 10 minutes: approved emails that are due, AI calls where Javad switched them on.
    if (Date.now() - lastOutbox > 10 * 60_000) {
      lastOutbox = Date.now();
      if (mailer) await sendDueEmails(db, mailer);
      if (voice) await startDueAiCalls(db, voice, planEnv());
    }
    // Watchdogs every hour: milestones waiting on the customer; stalled jobs, money due, people waiting on us.
    if (Date.now() - lastWatch > 60 * 60_000) {
      lastWatch = Date.now();
      await deliveryWatch(db);
      await opsWatch(db);
      // money: monthly fees of the month, reminders by due date (both idempotent)
      await billSubscriptions(db);
      await dunning(db);
      await ensurePartnerContracts(db);
    }
    // messages to customers, partners and leads (stay queued in Cockpit › Outbox without a mailer)
    if (mailer) await sendQueued(db, mailer);
    const n = await dispatchBatch(db, deps);
    if (n === 0) await new Promise((r) => setTimeout(r, 2000));
  } catch (err) {
    console.error("dispatch failed", err);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
await db.$client.end();
