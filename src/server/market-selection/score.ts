import type { Criterion } from "./criteria";

/** One candidate (a country, an industry or a company) with its raw criterion values. */
export type Candidate = {
  id: string;
  name: string;
  values: Record<string, number | null | undefined>;
  // per-criterion note on where the value came from, shown on the card
  sources?: Record<string, string>;
};

export type CriterionScore = {
  id: string;
  raw: number | null;
  // 0–10 within this candidate set
  score: number;
  points: number;
  missing: boolean;
};

export type Scored = {
  id: string;
  name: string;
  total: number;
  // share of the total weight that rests on real data (0–1)
  confidence: number;
  breakdown: CriterionScore[];
};

const NEUTRAL = 5;

/**
 * Percentile rank of `value` among `all`, scaled to 0–10. Ties share the mid rank, so two
 * equal values get the same score. With a single value there is nothing to compare: neutral.
 */
export function percentileScore(value: number, all: number[], direction: "higher" | "lower") {
  if (all.length < 2) return NEUTRAL;
  const below = all.filter((v) => v < value).length;
  const equal = all.filter((v) => v === value).length;
  const rank = (below + (equal - 1) / 2) / (all.length - 1);
  const s = rank * 10;
  return direction === "higher" ? s : 10 - s;
}

/**
 * Weighted score out of 100 (doc 13 §2.6 ب "قاعده محاسبه"): each criterion is ranked 0–10 among
 * the candidates and multiplied by its weight; a missing value scores a neutral 5 and lowers confidence.
 */
export function scoreCandidates(criteria: Criterion[], candidates: Candidate[]): Scored[] {
  const weightSum = criteria.reduce((s, c) => s + c.weight, 0);
  const columns = new Map(
    criteria.map((c) => [
      c.id,
      candidates.map((x) => x.values[c.id]).filter((v): v is number => typeof v === "number" && Number.isFinite(v)),
    ]),
  );

  return candidates
    .map((cand) => {
      let total = 0;
      let known = 0;
      const breakdown = criteria.map((c) => {
        const raw = cand.values[c.id];
        const has = typeof raw === "number" && Number.isFinite(raw);
        const score = has ? percentileScore(raw, columns.get(c.id)!, c.direction) : NEUTRAL;
        const points = (score / 10) * c.weight;
        total += points;
        if (has) known += c.weight;
        return { id: c.id, raw: has ? raw : null, score: round(score, 1), points: round(points, 1), missing: !has };
      });
      return {
        id: cand.id,
        name: cand.name,
        total: round((total / weightSum) * 100, 1),
        confidence: round(known / weightSum, 2),
        breakdown,
      };
    })
    .sort((a, b) => b.total - a.total);
}

/**
 * Automatic "market gap" mode (§2.6 ب): pain × low adoption × ready solution × low competition,
 * each taken as its 0–10 score. A product, so one zero kills the candidate.
 */
export function gapIndex(s: Scored, ids = { pain: ["labour_shortage", "personnel_share", "manual_work", "regulation"], adoption: "ai_gap", solution: "solutions", competition: "competition" }) {
  const by = new Map(s.breakdown.map((b) => [b.id, b.score]));
  const pain = ids.pain.map((id) => by.get(id) ?? NEUTRAL).reduce((a, b) => a + b, 0) / ids.pain.length;
  const parts = [pain, by.get(ids.adoption) ?? NEUTRAL, by.get(ids.solution) ?? NEUTRAL, by.get(ids.competition) ?? NEUTRAL];
  return round(parts.reduce((a, b) => a * (b / 10), 1) * 100, 1);
}

export function round(n: number, digits = 0) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
