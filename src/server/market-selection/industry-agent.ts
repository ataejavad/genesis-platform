import { INDUSTRY_CRITERIA, INDUSTRY_GATES } from "./criteria";
import { type Fetcher, type JsonStat, codes, labels, observations } from "./eurostat";
import { regulationPressure } from "./regulations";
import { SBS_DIVISIONS, sectionOf, divisionNumber, spreadToDivisions } from "./nace";
import { type Candidate, type Scored, gapIndex, round, scoreCandidates } from "./score";

/**
 * Agent 2: industry inside one country (runs monthly), doc 13 §2.6 ب.
 * Step 1 (this file): every NACE division scored from free statistics → gates → ranking.
 * Step 2–3 (prompts/industry-research.md): the top 10 are opened to sub-industries and the top 3
 * get deep research, which fills the researched criteria (manual work, regulation, solutions…).
 */

export type IndustryRow = Candidate & {
  section: string;
  gate: { passed: boolean; reasons: string[] };
  facts: Record<string, number | string | null>;
};

export type IndustryRun = {
  agent: "industry";
  country: string;
  ranAt: string;
  period: string;
  ranking: (Scored & { gap: number; section: string })[];
  dropped: { id: string; name: string; reasons: string[] }[];
  rows: IndustryRow[];
  // criteria still neutral (no data yet) for the top 10: the deep-research step fills these
  researchQueue: { id: string; name: string; missing: string[] }[];
};

const SIZES = ["TOTAL", "20-49", "50-249", "GE250"];
const INDICATORS = ["NETTUR_MEUR", "GOS_MEUR", "EXPN_SAL_BEN_MEUR", "EMP_NR", "ENT_NR"];

type Cube = Map<string, number>; // key: indic|nace|size|time

function cube(js: JsonStat): { data: Cube; times: string[] } {
  const data: Cube = new Map();
  for (const o of observations(js)) data.set(`${o.at.indic_sbs}|${o.at.nace_r2}|${o.at.size_emp}|${o.at.time}`, o.value);
  return { data, times: codes(js, "time") };
}

/**
 * Picks one code for every dimension except `by` and time, preferring `prefs` and logging what
 * was chosen, so a renamed Eurostat code shows up in the run log instead of silently breaking.
 */
export function series(js: JsonStat, by: string, prefs: Record<string, string[]>, log?: (m: string) => void) {
  const where: Record<string, string> = {};
  for (const d of js.id) {
    if (d === by || d === "time") continue;
    const avail = codes(js, d);
    const chosen = (prefs[d] ?? []).find((p) => avail.includes(p)) ?? avail[0];
    where[d] = chosen;
    if (avail.length > 1) log?.(`  ${d}: using ${chosen} of [${avail.slice(0, 12).join(", ")}${avail.length > 12 ? ", …" : ""}]`);
  }
  const out = new Map<string, number>();
  const bestTime = new Map<string, string>();
  for (const o of observations(js)) {
    if (Object.entries(where).some(([d, c]) => o.at[d] !== c)) continue;
    const k = o.at[by];
    const t = o.at.time ?? "";
    if (!bestTime.has(k) || t > bestTime.get(k)!) {
      bestTime.set(k, t);
      out.set(k, o.value);
    }
  }
  return out;
}

export async function runIndustryAgent(fetcher: Fetcher, country: string, log: (m: string) => void = () => {}): Promise<IndustryRun> {
  const [sbs, eu, ai, jvs] = await Promise.all([
    fetcher("sbs_sc_ovw", { indic_sbs: INDICATORS, nace_r2: SBS_DIVISIONS, size_emp: SIZES, geo: country, lastTimePeriod: 2 }),
    fetcher("sbs_sc_ovw", { indic_sbs: "EMP_NR", nace_r2: SBS_DIVISIONS, size_emp: "TOTAL", geo: "EU27_2020", lastTimePeriod: 1 }),
    fetcher("isoc_eb_ain2", { indic_is: "E_AI_TANY", unit: "PC_ENT", geo: country, lastTimePeriod: 1 }),
    fetcher("jvs_a_rate_r2", { geo: country, lastTimePeriod: 1 }),
  ]);

  const { data, times } = cube(sbs);
  const latest = times.at(-1)!;
  const prev = times.at(-2);
  const names = labels(sbs, "nace_r2");
  const get = (ind: string, nace: string, size = "TOTAL", t = latest) => data.get(`${ind}|${nace}|${size}|${t}`) ?? null;
  // a division may lack the latest year; fall back to the year before
  const val = (ind: string, nace: string, size = "TOTAL") => get(ind, nace, size) ?? (prev ? get(ind, nace, size, prev) : null);

  const euEmp = series(eu, "nace_r2", { size_emp: ["TOTAL"] });
  log("isoc_eb_ain2 (AI use by NACE):");
  const aiUse = spreadToDivisions(series(ai, "nace_r2", { size_emp: ["10-249", "GE10"], indic_is: ["E_AI_TANY"], unit: ["PC_ENT"] }, log));
  log("jvs_a_rate_r2 (job vacancy rate):");
  const vacancy = spreadToDivisions(series(jvs, "nace_r2", { sizeclas: ["TOTAL", "GE10"], indic_em: ["JOBRATE"], unit: ["PC"] }, log));

  const countryEmpTotal = SBS_DIVISIONS.reduce((s, d) => s + (val("EMP_NR", d) ?? 0), 0);
  const euEmpTotal = SBS_DIVISIONS.reduce((s, d) => s + (euEmp.get(d) ?? 0), 0);

  const rows: IndustryRow[] = SBS_DIVISIONS.map((d) => {
    const section = sectionOf(divisionNumber(d)!)!;
    const turnover = val("NETTUR_MEUR", d);
    const gos = val("GOS_MEUR", d);
    const personnel = val("EXPN_SAL_BEN_MEUR", d);
    const emp = val("EMP_NR", d);
    const firmsSmall = val("ENT_NR", d, "20-49");
    const firmsMedium = val("ENT_NR", d, "50-249");
    const targetFirms = firmsSmall !== null || firmsMedium !== null ? (firmsSmall ?? 0) + (firmsMedium ?? 0) : null;
    const gosTarget = sum(val("GOS_MEUR", d, "20-49"), val("GOS_MEUR", d, "50-249"));
    const turnoverLarge = val("NETTUR_MEUR", d, "GE250");
    const turnoverPrev = prev ? get("NETTUR_MEUR", d, "TOTAL", prev) : null;
    const turnoverNow = get("NETTUR_MEUR", d, "TOTAL", latest);
    const euE = euEmp.get(d) ?? null;

    const margin = turnover && gos !== null ? gos / turnover : null;
    const personnelShare = turnover && personnel !== null ? personnel / turnover : null;
    const growth = turnoverNow && turnoverPrev ? turnoverNow / turnoverPrev - 1 : null;
    const lq = emp && euE && countryEmpTotal && euEmpTotal ? emp / countryEmpTotal / (euE / euEmpTotal) : null;
    const fragmentation = turnover && turnoverLarge !== null ? 1 - turnoverLarge / turnover : null;
    const gosPerTargetFirm = gosTarget !== null && targetFirms ? (gosTarget * 1e6) / targetFirms : null;

    const reg = regulationPressure(country, d);

    const reasons: string[] = [];
    if ((INDUSTRY_GATES.excludedSections as readonly string[]).includes(section)) reasons.push(`section ${section} is outside our market`);
    if ((INDUSTRY_GATES.licensedSections as readonly string[]).includes(section)) reasons.push(`section ${section} needs a licence: only through a licensed partner`);
    if (gosPerTargetFirm !== null && gosPerTargetFirm < INDUSTRY_GATES.minGrossSurplusPerFirmEur) {
      reasons.push(`gross operating surplus per 20–249 staff firm ${Math.round(gosPerTargetFirm / 1000)}k EUR < ${INDUSTRY_GATES.minGrossSurplusPerFirmEur / 1000}k: can't pay ≥ 500 EUR/month reliably`);
    }
    if (!targetFirms) reasons.push("no firms with 20–249 staff in the statistics");

    return {
      id: d,
      name: names[d] ?? d,
      section,
      values: {
        turnover,
        target_firms: targetFirms,
        margin,
        growth,
        personnel_share: personnelShare,
        labour_shortage: vacancy.get(d)?.value ?? null,
        manual_work: null,
        regulation: reg.value,
        ai_gap: aiUse.has(d) ? 100 - aiUse.get(d)!.value : null,
        solutions: null,
        reachability: null,
        country_advantage: lq,
        competition: null,
        fragmentation,
        replicability: null,
      },
      sources: {
        turnover: `Eurostat sbs_sc_ovw ${latest}, million EUR`,
        ai_gap: aiUse.has(d) ? `Eurostat isoc_eb_ain2, from ${aiUse.get(d)!.from}` : "missing",
        regulation: reg.obligations.length ? `regulatory radar: ${reg.obligations.join(", ")}` : "regulatory radar: none found",
        labour_shortage: vacancy.has(d) ? `Eurostat jvs_a_rate_r2, from ${vacancy.get(d)!.from}` : "missing",
      },
      gate: { passed: reasons.length === 0, reasons },
      facts: {
        turnoverMeur: turnover,
        targetFirms,
        marginPct: margin === null ? null : round(margin * 100, 1),
        personnelSharePct: personnelShare === null ? null : round(personnelShare * 100, 1),
        growthPct: growth === null ? null : round(growth * 100, 1),
        locationQuotient: lq === null ? null : round(lq, 2),
        smallFirmTurnoverSharePct: fragmentation === null ? null : round(fragmentation * 100, 1),
        gosPerTargetFirmKeur: gosPerTargetFirm === null ? null : round(gosPerTargetFirm / 1000),
        aiUsePct: aiUse.get(d)?.value ?? null,
        vacancyRatePct: vacancy.get(d)?.value ?? null,
        employment: emp,
        obligations: reg.obligations.join(", ") || null,
      },
    };
  });

  const passing = rows.filter((r) => r.gate.passed);
  const scored = scoreCandidates(INDUSTRY_CRITERIA, passing).map((s) => ({
    ...s,
    gap: gapIndex(s),
    section: passing.find((r) => r.id === s.id)!.section,
  }));

  return {
    agent: "industry",
    country,
    ranAt: new Date().toISOString(),
    period: latest,
    ranking: scored,
    dropped: rows.filter((r) => !r.gate.passed).map((r) => ({ id: r.id, name: r.name, reasons: r.gate.reasons })),
    rows,
    researchQueue: scored.slice(0, 10).map((s) => ({ id: s.id, name: s.name, missing: s.breakdown.filter((b) => b.missing).map((b) => b.id) })),
  };
}

function sum(a: number | null, b: number | null) {
  return a === null && b === null ? null : (a ?? 0) + (b ?? 0);
}
