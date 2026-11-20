import { getDb } from "@/db";
import { mailerFromEnv } from "@/server/mailer";
import { sendQueued } from "@/server/notify";
import { runDue } from "@/server/orchestrator";
import { isStopped } from "@/server/switches";
import { adminChatFromEnv } from "@/server/admin-chat";
import { voiceFromEnv } from "@/server/voice";
import { dispatchBatch } from "./dispatch";

// Background worker: drains the event outbox and runs the orchestrator's due jobs. Runs as its own container next to the app.
const db = getDb();
const deps = { adminChat: adminChatFromEnv(), n8nWebhookUrl: process.env.N8N_EVENTS_WEBHOOK_URL || undefined };
const jobDeps = { mailer: mailerFromEnv(), voice: voiceFromEnv(), adminChat: deps.adminChat };
let running = true;
let lastJobs = 0;

process.on("SIGTERM", () => (running = false));
process.on("SIGINT", () => (running = false));

console.log(`worker started (admin chat: ${deps.adminChat?.provider ?? "off"}, n8n: ${deps.n8nWebhookUrl ? "on" : "off"})`);
while (running) {
  try {
    // every job with its schedule lives in src/server/orchestrator.ts (Cockpit › Today shows them)
    if (Date.now() - lastJobs > 60_000) {
      lastJobs = Date.now();
      await runDue(db, jobDeps);
    }
    // messages to customers, partners and leads (stay queued in Cockpit › Outbox without a mailer)
    if (jobDeps.mailer && !(await isStopped(db))) await sendQueued(db, jobDeps.mailer);
    const n = await dispatchBatch(db, deps);
    if (n === 0) await new Promise((r) => setTimeout(r, 2000));
  } catch (err) {
    console.error("dispatch failed", err);
    await new Promise((r) => setTimeout(r, 5000));
  }
}
await db.$client.end();
