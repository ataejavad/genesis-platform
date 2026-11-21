import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/db";
import { JOBS } from "@/server/orchestrator";
import { runTick, tickDepsFromEnv } from "@/server/tick";

// The background worker's pass for hosts without one (Vercel): orchestrator jobs + outbox + emails.
// Called by Vercel Cron (daily on the free plan) and the hourly GitHub workflow .github/workflows/tick.yml.
// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` on its own.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function allowed(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: Request) {
  if (!allowed(req)) return Response.json({ error: "unauthorized" }, { status: 401 });
  // ?run=<job id>[,<job id>]: run those jobs now even if not due (GitHub Actions "Run workflow" with a job name)
  const run = new URL(req.url).searchParams.get("run");
  const only = run ? run.split(",").map((j) => j.trim()).filter((j) => JOBS.some((x) => x.id === j)) : undefined;
  if (run && !only?.length) return Response.json({ error: `unknown job ${run}` }, { status: 400 });
  const result = await runTick(getDb(), tickDepsFromEnv(), { jobs: true, budgetMs: 240_000, only });
  return Response.json(result);
}
