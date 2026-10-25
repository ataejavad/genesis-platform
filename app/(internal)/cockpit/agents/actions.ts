"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { setAgent } from "@/server/agents";
import { dailyReport } from "@/server/daily-report";
import { decideExperiment, setLessonActive } from "@/server/improve";
import { mailerFromEnv } from "@/server/mailer";
import { runNow } from "@/server/orchestrator";
import { telegramConfigFromEnv } from "@/server/telegram";
import { voiceFromEnv } from "@/server/voice";

// Machine actions (step 9): agent switches and budgets, jobs, the brief, experiments and lessons.
export type Result = { ok: boolean; message: string } | null;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function act(fn: (actor: { type: "user"; id: string }) => Promise<string>): Promise<Result> {
  const user = await requireAdmin();
  try {
    const message = await fn({ type: "user", id: user.id });
    for (const p of ["/cockpit", "/cockpit/agents", "/cockpit/experiments"]) revalidatePath(p);
    return { ok: true, message };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message.slice(0, 300) : "failed" };
  }
}

export async function agentSwitch(_: Result, f: FormData): Promise<Result> {
  return act(async (a) => {
    const id = str(f, "agent");
    const op = str(f, "op");
    if (op === "budget") {
      const v = Number(str(f, "budget"));
      if (!Number.isFinite(v) || v < 0 || v > 5000) throw new Error("budget must be 0–5000 €");
      await setAgent(getDb(), a, id, { budgetEur: v });
      return `Budget €${v}/month`;
    }
    await setAgent(getDb(), a, id, op === "resume" ? { resume: true } : { enabled: op === "on" });
    return op === "resume" ? "Resumed" : op === "on" ? "Switched on" : "Switched off";
  });
}

export async function runJobNow(_: Result, f: FormData): Promise<Result> {
  return act(async () => ((await runNow(getDb(), { mailer: mailerFromEnv(), voice: voiceFromEnv(), telegram: telegramConfigFromEnv() }, str(f, "job"))) ? "Done" : "Failed: see the error in the list"));
}

export async function refreshBrief(): Promise<Result> {
  return act(async () => (await dailyReport(getDb(), new Date(), null)).verdict);
}

export async function decide(_: Result, f: FormData): Promise<Result> {
  return act(async (a) => {
    const r = await decideExperiment(getDb(), a, str(f, "experiment"), str(f, "op") === "adopt", str(f, "note") || undefined);
    return `${r.status}: ${r.winner} for everyone; the lesson is stored`;
  });
}

export async function lessonSwitch(_: Result, f: FormData): Promise<Result> {
  return act(async (a) => (await setLessonActive(getDb(), a, str(f, "lesson"), str(f, "op") === "on"), str(f, "op") === "on" ? "Agents read it again" : "Agents no longer read it"));
}
