import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { and, count, gte, notInArray } from "drizzle-orm";
import type { Db } from "@/db";
import { checkups, leads } from "@/db/schema";
import type { Actor } from "./actor";
import { setSwitch, switchesLike } from "./switches";

/*
 * Market filters (step 1 output, wired in step 10): the monthly market-selection run ranks NACE divisions per
 * country. Javad approves or pauses a filter here (hard gate). A paused filter stops the company finder for every
 * outbound target in that division; approved and undecided filters keep running.
 */

type Ranked = { id: string; name: string; total: number; confidence: number };
type Run = { ranAt?: string; period?: number | string; ranking: Ranked[]; dropped: { id: string; name: string; reasons: string[] }[]; researchQueue?: { id: string; name: string; missing: string[] }[] };

const ROOT = "data/market-selection/runs";

/** Latest run folder of the monthly market-selection agents (GitHub Actions commit their output). */
export function lastMarketRun(root = ROOT) {
  if (!existsSync(root)) return null;
  return readdirSync(root).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().at(-1) ?? null;
}
export const filterId = (country: string, nace: string) => `filter:${country.toUpperCase()}:${nace.slice(0, 3).toUpperCase()}`;

export function loadRun(country: string, day = lastMarketRun(ROOT)): (Run & { day: string }) | null {
  if (!day) return null;
  const file = path.join(ROOT, day, `industry-${country.toUpperCase()}.json`);
  return existsSync(file) ? { ...(JSON.parse(readFileSync(file, "utf8")) as Run), day } : null;
}

export function runCountries(day = lastMarketRun(ROOT)) {
  if (!day) return [];
  const file = path.join(ROOT, day, "country.json");
  if (!existsSync(file)) return [];
  return (JSON.parse(readFileSync(file, "utf8")) as { ranking: Ranked[] }).ranking;
}

/** Ranking per country with Javad's decision on each filter. */
export async function marketFilters(db: Db, countries = ["IT", "DE"], top = 12) {
  const decided = await switchesLike(db, "filter:");
  return countries.flatMap((cc) => {
    const run = loadRun(cc);
    if (!run) return [];
    const rows = run.ranking.slice(0, top).map((r, i) => {
      const s = decided.get(filterId(cc, r.id));
      return { ...r, rank: i + 1, decision: s ? (s.enabled ? "approved" : "paused") : "undecided", by: s?.updatedBy ?? null };
    });
    return [{ country: cc, day: run.day, period: run.period, rows, dropped: run.dropped.length, researchQueue: run.researchQueue ?? [] }];
  });
}

export async function decideFilter(db: Db, actor: Actor, country: string, nace: string, approve: boolean, note?: string) {
  await setSwitch(db, actor, filterId(country, nace), approve, note);
}

/** Paused filters (for the company finder). */
export async function pausedFilters(db: Db) {
  return [...(await switchesLike(db, "filter:")).values()].filter((s) => !s.enabled).map((s) => s.id);
}

/** Check-ups and leads from trades without a hub (last 90 days): demand signal for the next selection run. */
export async function demandWithoutHub(db: Db, hubIndustries: string[], now = new Date()) {
  const since = new Date(now.getTime() - 90 * 864e5);
  const skip = hubIndustries.length ? hubIndustries : ["-"];
  const c = await db.select({ industry: checkups.industry, country: checkups.country, n: count() }).from(checkups).where(and(gte(checkups.createdAt, since), notInArray(checkups.industry, skip))).groupBy(checkups.industry, checkups.country);
  const l = await db.select({ industry: leads.industry, country: leads.country, n: count() }).from(leads).where(and(gte(leads.createdAt, since), notInArray(leads.industry, skip))).groupBy(leads.industry, leads.country);
  const m = new Map<string, { industry: string; country: string; checkups: number; leads: number }>();
  for (const r of c) m.set(`${r.industry}|${r.country}`, { industry: r.industry, country: r.country, checkups: r.n, leads: 0 });
  for (const r of l) {
    const k = `${r.industry}|${r.country}`;
    m.set(k, { ...(m.get(k) ?? { industry: r.industry, country: r.country, checkups: 0, leads: 0 }), leads: r.n });
  }
  return [...m.values()].sort((a, b) => b.checkups + b.leads - (a.checkups + a.leads));
}
