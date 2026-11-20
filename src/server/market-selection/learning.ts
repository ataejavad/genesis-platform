import type { Criterion } from "./criteria";
import { round } from "./score";

/**
 * Monthly learning job (doc 13 §2.6 و). Every lead keeps the criterion scores it was picked with;
 * once real outcomes exist we check (1) whether the scoring predicts buying at all and (2) which
 * criteria actually go with buying. Weight changes are proposals, ±5 max, for Javad to approve.
 */

export type Outcome = {
  score: number; // total score the lead had when picked
  criterionScores: Record<string, number>; // 0–10 per criterion
  bought: boolean;
  revenueEur?: number;
};

export const MIN_OUTCOMES = 30;
export const MAX_STEP = 5;

/** Predictive accuracy: buying rate of the top third of scores vs the bottom third. */
export function predictiveAccuracy(outcomes: Outcome[]) {
  if (outcomes.length < MIN_OUTCOMES) return { enough: false as const, n: outcomes.length };
  const sorted = [...outcomes].sort((a, b) => b.score - a.score);
  const third = Math.floor(sorted.length / 3);
  const rate = (xs: Outcome[]) => xs.filter((o) => o.bought).length / xs.length;
  const top = rate(sorted.slice(0, third));
  const bottom = rate(sorted.slice(-third));
  return {
    enough: true as const,
    n: outcomes.length,
    topRate: round(top, 3),
    bottomRate: round(bottom, 3),
    lift: bottom > 0 ? round(top / bottom, 2) : top > 0 ? Infinity : 1,
    // the scoring is worthless if the best-scored leads don't buy more than the worst
    recalibrate: top <= bottom,
  };
}

/**
 * Suggests new weights: criteria whose score separates buyers from non-buyers gain weight, the rest
 * lose it, each by at most ±5, and the total stays the same. Returns null until enough outcomes.
 */
export function suggestWeights(criteria: Criterion[], outcomes: Outcome[]) {
  if (outcomes.length < MIN_OUTCOMES) return null;
  const buyers = outcomes.filter((o) => o.bought);
  const others = outcomes.filter((o) => !o.bought);
  if (!buyers.length || !others.length) return null;
  const mean = (xs: Outcome[], id: string) => xs.reduce((s, o) => s + (o.criterionScores[id] ?? 5), 0) / xs.length;

  // separation in score points between buyers and non-buyers, −10..10
  const sep = criteria.map((c) => mean(buyers, c.id) - mean(others, c.id));
  const avgSep = sep.reduce((a, b) => a + b, 0) / sep.length;
  const deltas = sep.map((s) => clamp(Math.round((s - avgSep) / 2), -MAX_STEP, MAX_STEP));
  const raw = criteria.map((c, i) => Math.max(1, c.weight + deltas[i]));

  // keep the old total: spread the gap one point at a time over criteria that still have room
  const target = criteria.reduce((s, c) => s + c.weight, 0);
  let gap = target - raw.reduce((a, b) => a + b, 0);
  for (let guard = 0; gap !== 0 && guard < 1000; guard++) {
    const step = Math.sign(gap);
    const i = guard % raw.length;
    const next = raw[i] + step;
    if (next >= 1 && Math.abs(next - criteria[i].weight) <= MAX_STEP) {
      raw[i] = next;
      gap -= step;
    }
  }

  return criteria.map((c, i) => ({
    id: c.id,
    from: c.weight,
    to: raw[i],
    separation: round(sep[i], 2),
  }));
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}
