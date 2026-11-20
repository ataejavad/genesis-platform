import { applyPlatformDefaults } from "./src/lib/platform";

// Runs once when a server instance starts, before it answers any request.
export async function register() {
  applyPlatformDefaults();
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.TICK_AFTER_REQUESTS !== "1") return;
  // No always-on worker (Vercel): events, emails and alerts are processed right after the request that caused them.
  const { after } = await import("next/server");
  const { setTickScheduler } = await import("./src/server/tick-soon");
  const { runTick, tickDepsFromEnv } = await import("./src/server/tick");
  const { getDb } = await import("./src/db");
  setTickScheduler(() =>
    after(async () => {
      await runTick(getDb(), tickDepsFromEnv(), { jobs: false, budgetMs: 25_000 });
    }),
  );
}
