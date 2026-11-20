/**
 * Market-selection criteria, weights, gates, budgets and funnel targets.
 * Source of truth for the design: business-plan/13-categories-and-machine.md §2.6 (decided 2026-10-23).
 * Weights are hypotheses until real sales data exists; the learning job may move each by at most
 * ±5 points a month, and only with Javad's approval (§2.6 و).
 */

export type Direction = "higher" | "lower";

export type Criterion = {
  id: string;
  label: string;
  weight: number;
  // "higher": a bigger value is better for us; "lower": a smaller value is better
  direction: Direction;
  // where the value comes from: an automatic dataset or a researched/manual input
  source: string;
};

export type Level = "country" | "industry" | "company";

export const COUNTRY_CRITERIA: Criterion[] = [
  { id: "ai_gap", label: "AI adoption gap in SMEs", weight: 20, direction: "higher", source: "Eurostat isoc_eb_ai (100 − % of 10–249 staff firms using AI)" },
  { id: "sme_count", label: "Firms with 20–249 staff", weight: 20, direction: "higher", source: "Eurostat sbs_sc_ovw (size classes 20–49, 50–249)" },
  { id: "momentum", label: "Money inflow and economic momentum", weight: 20, direction: "higher", source: "Eurostat namq_10_gdp (real GDP, % change on same quarter a year earlier)" },
  { id: "subsidies", label: "Digitalisation subsidies", weight: 10, direction: "higher", source: "researched input (incentivi.gov.it, foerderdatenbank.de, gov.uk)" },
  { id: "labour_cost", label: "Hourly labour cost (ability to pay + automation ROI)", weight: 10, direction: "higher", source: "Eurostat lc_lci_lev (EUR per hour)" },
  { id: "access", label: "Our access (language + invoicing)", weight: 10, direction: "higher", source: "internal input; no personal network (Javad, 2026-10-23)" },
  { id: "legal", label: "Legal, tax and outreach simplicity", weight: 10, direction: "higher", source: "researched input (doc 13 §2.6 ح)" },
];

export const INDUSTRY_CRITERIA: Criterion[] = [
  // size & money (30)
  { id: "turnover", label: "Industry turnover in the country", weight: 8, direction: "higher", source: "Eurostat sbs_ovw_act (net turnover)" },
  { id: "target_firms", label: "Firms with 20–249 staff in this NACE", weight: 10, direction: "higher", source: "Eurostat sbs_sc_ovw (enterprises by size class)" },
  { id: "margin", label: "Profit margin (gross operating surplus ÷ turnover)", weight: 8, direction: "higher", source: "Eurostat sbs_ovw_act" },
  { id: "growth", label: "Industry growth", weight: 4, direction: "higher", source: "Eurostat sts_trtu / sts_inpr (or turnover change)" },
  // pain (30)
  { id: "personnel_share", label: "Personnel cost share of turnover", weight: 7, direction: "higher", source: "Eurostat sbs_ovw_act" },
  { id: "labour_shortage", label: "Labour shortage (job vacancy rate)", weight: 8, direction: "higher", source: "Eurostat jvs_a_rate_r2 + job ads" },
  { id: "manual_work", label: "Manual, repetitive work", weight: 7, direction: "higher", source: "researched: EU LFS NACE×ISCO clerical share, APQC processes" },
  { id: "regulation", label: "Pressure from new regulation", weight: 8, direction: "higher", source: "researched: e-invoicing, CSRD, NIS2, AI Act, EUDR" },
  // readiness to buy (20)
  { id: "ai_gap", label: "Digital/AI gap in this industry", weight: 8, direction: "higher", source: "Eurostat isoc_eb_ain2" },
  { id: "solutions", label: "Ready, proven solutions and case studies", weight: 7, direction: "higher", source: "researched: catalog, G2, Capterra" },
  { id: "reachability", label: "Buyer reachability", weight: 5, direction: "higher", source: "researched: associations, fairs, Europages" },
  // competition & strategy (20)
  { id: "country_advantage", label: "Country's competitive advantage (RCA / location quotient)", weight: 6, direction: "higher", source: "Eurostat sbs_ovw_act employment share vs EU (location quotient)" },
  { id: "competition", label: "Competition from other integrators (low is better)", weight: 5, direction: "lower", source: "researched: competitor search" },
  { id: "fragmentation", label: "Fragmentation (many small owner-run firms)", weight: 4, direction: "higher", source: "Eurostat sbs_sc_ovw (share of turnover in firms < 250 staff)" },
  { id: "replicability", label: "Same pain in other countries/sub-industries", weight: 5, direction: "higher", source: "this table run for other countries" },
];

export const COMPANY_CRITERIA: Criterion[] = [
  { id: "fit", label: "Fit: right NACE, 20–150 staff, region, turnover", weight: 40, direction: "higher", source: "company registers, OpenCorporates" },
  { id: "need", label: "Need signals: growth, repetitive-role job ads, outdated site/tech, slow-service reviews, new manager", weight: 40, direction: "higher", source: "Apify (Maps, job boards), Firecrawl, Wappalyzer" },
  { id: "reach", label: "Reachable: public contact, known decision maker, consented email", weight: 20, direction: "higher", source: "company website, own opt-in sources" },
];

export const CRITERIA: Record<Level, Criterion[]> = {
  country: COUNTRY_CRITERIA,
  industry: INDUSTRY_CRITERIA,
  company: COMPANY_CRITERIA,
};

/** Countries the country agent compares. Gates: we can invoice there, we cover the language, EU or UK. */
export const CANDIDATE_COUNTRIES = ["DE", "IT", "UK", "AT", "IE"] as const;
export type CountryCode = (typeof CANDIDATE_COUNTRIES)[number];

/** Industry gates (§2.6 ب). A candidate failing any gate is dropped before scoring. */
export const INDUSTRY_GATES = {
  // proxy for "an average firm can pay ≥ 500 EUR/month": gross operating surplus per firm, EUR/year
  minGrossSurplusPerFirmEur: 150_000,
  // NACE sections that need a licence for the core work; only through a licensed partner
  licensedSections: ["K", "Q"],
  // NACE sections outside our market (public administration, households, extraterritorial)
  excludedSections: ["O", "T", "U"],
  // IT service firms are our suppliers and competitors, not buyers of a tech broker
  excludedDivisions: ["J62", "J63"],
  // below this share of weight resting on real data a candidate is shown but not ranked
  minConfidence: 0.7,
} as const;

/** Value filter: KPI + budget cap per agent (§2.6 ه). */
export const AGENT_BUDGETS = {
  country: { kpi: "% of chosen countries with a first paying customer within 90 days", capEur: 10, per: "run" },
  industry: { kpi: "% of industries passing the demand test; cost per meeting", capEur: 30, per: "month" },
  company: { kpi: "meetings per 100 companies delivered; cost per lead", capEur: 2, per: "day", maxCompaniesPerDay: 50 },
} as const;

/** Diagnostic funnel targets (§2.6 ز). Hypotheses until real data. */
export const FUNNEL_TARGETS = {
  replyRate: 0.05,
  interestRate: 0.3,
  winRate: 0.2,
  maxMonthlyChurn: 0.03,
  minNrr: 1.0,
  ltvToCac: 3,
  maxCacPaybackMonths: 6,
  // no decision on an industry before 90 days or 10 meetings, whichever comes first
  industryPatienceDays: 90,
  industryPatienceMeetings: 10,
} as const;

/** Cold start (Javad, 2026-10-23): test the top two industries in parallel. */
export const COLD_START = { parallelIndustries: 2, companiesPerIndustry: 50, minMeetingsToPass: 3, testWeeks: 2 } as const;

export function totalWeight(criteria: Criterion[]) {
  return criteria.reduce((s, c) => s + c.weight, 0);
}
