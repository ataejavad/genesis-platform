/*
 * Defaults for the host we run on, so the founder pastes as few settings as possible.
 * Only fills what is not set; anything set in the host's settings wins.
 *
 * Vercel (test phase, 2026-11-20): no lasting disk and no always-on worker.
 *  - public address = the project's production domain (APP_URL, BETTER_AUTH_URL)
 *  - files go to our Postgres (STORAGE_PROVIDER=database)
 *  - connection pooler: no named prepared statements, few connections per instance
 *  - background work runs after requests and from /api/cron/tick (src/server/tick.ts)
 */
type Env = Record<string, string | undefined>;

export function applyPlatformDefaults(env: Env = process.env) {
  if (!env.VERCEL) return;
  const host = env.VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_URL;
  if (host) {
    env.APP_URL ??= `https://${host}`;
    env.BETTER_AUTH_URL ??= env.APP_URL;
  }
  env.STORAGE_PROVIDER ||= "database";
  env.DATABASE_PREPARE ??= "false";
  env.DATABASE_POOL_MAX ??= "3";
  env.TICK_AFTER_REQUESTS ??= "1";
}

/** Addresses of this deployment that may sign in besides APP_URL (Vercel preview links). */
export function extraOrigins(env: Env = process.env) {
  return [env.VERCEL_URL, env.VERCEL_BRANCH_URL].filter(Boolean).map((h) => `https://${h}`);
}

/** Search engines may index the public site. Off on Vercel (test phase, demo data) unless SITE_INDEXABLE=1. */
export function siteIndexable(env: Env = process.env) {
  return env.SITE_INDEXABLE === "1" || (!env.VERCEL && env.SITE_INDEXABLE !== "0");
}
