import { CANDIDATE_COUNTRIES, COUNTRY_CRITERIA, type CountryCode } from "./criteria";
import { type Fetcher, latestBy } from "./eurostat";
import { COUNTRY_INPUTS, UK_STATS } from "./inputs";
import { type Candidate, type Scored, scoreCandidates } from "./score";

/**
 * Agent 1: country (runs quarterly). Statistics from Eurostat, the rest from researched inputs.
 * Output goes to Javad's approval gate before the industry agent runs (doc 13 §2.6 الف).
 */

export const COUNTRY_NAMES: Record<CountryCode, string> = {
  DE: "Germany", IT: "Italy", UK: "United Kingdom", AT: "Austria", IE: "Ireland",
};

export type CountryRun = {
  agent: "country";
  ranAt: string;
  ranking: Scored[];
  candidates: Candidate[];
  periods: Record<string, string>;
};

export async function runCountryAgent(fetcher: Fetcher, countries: readonly CountryCode[] = CANDIDATE_COUNTRIES): Promise<CountryRun> {
  const geo = countries.filter((c) => c !== "UK");
  const [ai, sme, gdp, lc] = await Promise.all([
    fetcher("isoc_eb_ai", { indic_is: "E_AI_TANY", unit: "PC_ENT", size_emp: "10-249", nace_r2: "C10-S951_X_K", geo, lastTimePeriod: 1 }),
    fetcher("sbs_sc_ovw", { indic_sbs: "ENT_NR", nace_r2: "B-S_X_O_S94", size_emp: ["20-49", "50-249"], geo, lastTimePeriod: 1 }),
    fetcher("namq_10_gdp", { unit: "CLV_PCH_SM", s_adj: "SCA", na_item: "B1GQ", geo, lastTimePeriod: 1 }),
    fetcher("lc_lci_lev", { unit: "EUR", lcstruct: "D1_D4_MD5", nace_r2: "B-S_X_O", geo, lastTimePeriod: 1 }),
  ]);

  const aiBy = latestBy(ai, "geo");
  const small = latestBy(sme, "geo", { size_emp: "20-49" });
  const medium = latestBy(sme, "geo", { size_emp: "50-249" });
  const gdpBy = latestBy(gdp, "geo");
  const lcBy = latestBy(lc, "geo");

  const candidates: Candidate[] = countries.map((c) => {
    const inputs = COUNTRY_INPUTS[c];
    if (c === "UK") {
      return {
        id: c,
        name: COUNTRY_NAMES[c],
        values: {
          ai_gap: UK_STATS.ai_gap.value,
          sme_count: UK_STATS.sme_count.value,
          momentum: UK_STATS.momentum.value,
          labour_cost: UK_STATS.labour_cost.value,
          subsidies: inputs.subsidies.value,
          access: inputs.access.value,
          legal: inputs.legal.value,
        },
        sources: {
          ai_gap: UK_STATS.ai_gap.note, sme_count: UK_STATS.sme_count.note, momentum: `ONS: ${UK_STATS.momentum.note}`,
          labour_cost: UK_STATS.labour_cost.note, subsidies: inputs.subsidies.note, access: inputs.access.note, legal: inputs.legal.note,
        },
      };
    }
    const aiUse = aiBy.get(c);
    const s = small.get(c);
    const m = medium.get(c);
    return {
      id: c,
      name: COUNTRY_NAMES[c],
      values: {
        ai_gap: aiUse ? 100 - aiUse.value : null,
        sme_count: s && m ? s.value + m.value : null,
        momentum: gdpBy.get(c)?.value ?? null,
        labour_cost: lcBy.get(c)?.value ?? null,
        subsidies: inputs.subsidies.value,
        access: inputs.access.value,
        legal: inputs.legal.value,
      },
      sources: {
        ai_gap: aiUse ? `Eurostat isoc_eb_ai ${aiUse.time}: ${aiUse.value}% of 10–249 staff firms use AI` : "missing",
        sme_count: s && m ? `Eurostat sbs_sc_ovw ${s.time}: ${s.value} (20–49) + ${m.value} (50–249)` : "missing",
        momentum: gdpBy.get(c) ? `Eurostat namq_10_gdp ${gdpBy.get(c)!.time}: real GDP ${gdpBy.get(c)!.value}% y/y` : "missing",
        labour_cost: lcBy.get(c) ? `Eurostat lc_lci_lev ${lcBy.get(c)!.time}: ${lcBy.get(c)!.value} EUR/hour` : "missing",
        subsidies: inputs.subsidies.note,
        access: inputs.access.note,
        legal: inputs.legal.note,
      },
    };
  });

  return {
    agent: "country",
    ranAt: new Date().toISOString(),
    ranking: scoreCandidates(COUNTRY_CRITERIA, candidates),
    candidates,
    periods: {
      ai_gap: [...aiBy.values()][0]?.time ?? "",
      sme_count: [...small.values()][0]?.time ?? "",
      momentum: [...gdpBy.values()][0]?.time ?? "",
      labour_cost: [...lcBy.values()][0]?.time ?? "",
    },
  };
}
