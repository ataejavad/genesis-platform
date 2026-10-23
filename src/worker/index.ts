import { getDb } from "@/db";
import { telegramConfigFromEnv } from "@/server/telegram";
import { planEnv } from "@/server/crm";
import { mailerFromEnv } from "@/server/mailer";
import { sendDueEmails, startDueAiCalls } from "@/server/outreach";
import { voiceFromEnv } from "@/server/voice";
import { dispatchBatch } from "./dispatch";

// Background worker: drains the event outbox. Runs as its own container next to the app.
const db = getDb();
const deps = { telegram: telegramConfigFromEnv(), n8nWebhookUrl: process.env.N8N_EVENTS_WEBHOOK_URL || undefined };
const mailer = mailerFromEnv();
const voice = voiceFromEnv();
let running = true;
let lastOutbox = 0;

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
    const n = await dispatchBatch(db, deps);
    if (n === 0) await new Promise((r) => setTimeout(r, 2000));
  } catch (err) {
    console.error("dispatch failed", err);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
await db.$client.end();
