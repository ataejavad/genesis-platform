/**
 * NACE Rev. 2 helpers. Industry scoring runs on 2-digit divisions; some Eurostat tables (AI use,
 * job vacancies) only publish sections or ranges like "C10-C12" or "D35-E39", so each division
 * takes the value of the narrowest published code that covers it.
 */

export const SECTIONS: Record<string, [number, number]> = {
  B: [5, 9], C: [10, 33], D: [35, 35], E: [36, 39], F: [41, 43], G: [45, 47], H: [49, 53], I: [55, 56],
  J: [58, 63], K: [64, 66], L: [68, 68], M: [69, 75], N: [77, 82], O: [84, 84], P: [85, 85], Q: [86, 88],
  R: [90, 93], S: [94, 96],
};

// Divisions that exist in NACE Rev. 2 (gaps such as 34, 40, 44, 48 are not used)
const EXISTING = new Set([
  5, 6, 7, 8, 9, ...range(10, 33), 35, 36, 37, 38, 39, 41, 42, 43, 45, 46, 47, 49, 50, 51, 52, 53, 55, 56,
  58, 59, 60, 61, 62, 63, 64, 65, 66, 68, 69, 70, 71, 72, 73, 74, 75, 77, 78, 79, 80, 81, 82, 84, 85, 86, 87, 88,
  90, 91, 92, 93, 94, 95, 96,
]);

/** Divisions covered by the structural business statistics (B–S without K, O, S94). */
export const SBS_DIVISIONS = [...EXISTING]
  .filter((d) => d >= 5 && ![64, 65, 66, 84, 94].includes(d))
  .map((d) => divisionCode(d));

export function sectionOf(division: number) {
  for (const [s, [a, b]] of Object.entries(SECTIONS)) if (division >= a && division <= b) return s;
  return null;
}

export function divisionCode(d: number) {
  const s = sectionOf(d);
  return `${s}${String(d).padStart(2, "0")}`;
}

export function divisionNumber(code: string) {
  const m = /^[A-U](\d{2})$/.exec(code);
  return m ? Number(m[1]) : null;
}

/** Divisions a published code covers, or null for codes we can't map (totals with exclusions etc.). */
export function coverage(code: string): number[] | null {
  if (/^[A-U]$/.test(code)) {
    const r = SECTIONS[code];
    return r ? range(r[0], r[1]).filter((d) => EXISTING.has(d)) : null;
  }
  const single = /^[A-U](\d{2})$/.exec(code);
  if (single) return [Number(single[1])];
  const span = /^([A-U])(\d{2})?-([A-U])(\d{2})?$/.exec(code);
  if (span) {
    const from = span[2] ? Number(span[2]) : SECTIONS[span[1]]?.[0];
    const to = span[4] ? Number(span[4]) : SECTIONS[span[3]]?.[1];
    if (from === undefined || to === undefined) return null;
    return range(from, to).filter((d) => EXISTING.has(d));
  }
  return null;
}

/**
 * For each division, the value of the narrowest code in `byCode` that covers it.
 * Excludes broad totals (more than `maxSpan` divisions) so "all activities" never stands in for an industry.
 */
export function spreadToDivisions(byCode: Map<string, number>, maxSpan = 30) {
  const out = new Map<string, { value: number; from: string }>();
  const covered = [...byCode.entries()]
    .map(([code, value]) => ({ code, value, cov: coverage(code) }))
    .filter((x): x is { code: string; value: number; cov: number[] } => !!x.cov && x.cov.length <= maxSpan);
  for (const div of SBS_DIVISIONS) {
    const n = divisionNumber(div)!;
    const best = covered.filter((x) => x.cov.includes(n)).sort((a, b) => a.cov.length - b.cov.length)[0];
    if (best) out.set(div, { value: best.value, from: best.code });
  }
  return out;
}

function range(a: number, b: number) {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}
