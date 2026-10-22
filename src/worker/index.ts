import { getDb } from "@/db";
import { telegramConfigFromEnv } from "@/server/telegram";
import { dispatchBatch } from "./dispatch";

// Background worker: drains the event outbox. Runs as its own container next to the app.
const db = getDb();
const deps = { telegram: telegramConfigFromEnv(), n8nWebhookUrl: process.env.N8N_EVENTS_WEBHOOK_URL || undefined };
let running = true;

process.on("SIGTERM", () => (running = false));
process.on("SIGINT", () => (running = false));

console.log(`worker started (telegram: ${deps.telegram ? "on" : "off"}, n8n: ${deps.n8nWebhookUrl ? "on" : "off"})`);
while (running) {
  try {
    const n = await dispatchBatch(db, deps);
    if (n === 0) await new Promise((r) => setTimeout(r, 2000));
  } catch (err) {
    console.error("dispatch failed", err);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
await db.$client.end();
