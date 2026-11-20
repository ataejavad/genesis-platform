import { AGENT_BUDGETS, COMPANY_CRITERIA } from "./criteria";
import { round } from "./score";

/**
 * Agent 3: company (runs daily → CRM), doc 13 §2.6 ج. Finds firms in the approved market and
 * scores them. Collection (registers, Maps, job boards, websites) needs Apify/Firecrawl keys and runs
 * in n8n; the prompt for the research part is prompts/company.md. Scoring is here so every lead
 * carries the exact criterion scores it was picked with (the learning loop needs them).
 */

export type CompanySignals = {
  name: string;
  website?: string;
  nace?: string;
  staff?: number;
  region?: string;
  // need signals (true = seen, with the evidence URL in `evidence`)
  hiringRepetitiveRoles?: boolean;
  growing?: boolean;
  outdatedWebsite?: boolean;
  noOnlineBookingOrForms?: boolean;
  oldTechStack?: boolean;
  slowServiceReviews?: boolean;
  newManager?: boolean;
  affectedByObligation?: string[]; // ids from the regulatory radar
  // reachability
  publicEmailOrPhone?: boolean;
  decisionMakerKnown?: boolean;
  consentedEmail?: boolean;
  evidence?: Record<string, string>;
};

export type Market = { nace: string[]; regions?: string[]; minStaff?: number; maxStaff?: number };

export function scoreCompany(c: CompanySignals, market: Market) {
  const min = market.minStaff ?? 20;
  const max = market.maxStaff ?? 150;

  // fit (0–10): industry, size, region
  let fit = 0;
  if (c.nace && market.nace.some((n) => c.nace!.startsWith(n))) fit += 5;
  if (c.staff !== undefined) fit += c.staff >= min && c.staff <= max ? 4 : c.staff >= 10 && c.staff <= 249 ? 2 : 0;
  if (!market.regions?.length || (c.region && market.regions.includes(c.region))) fit += 1;

  // need (0–10): each signal adds, capped
  const needSignals = [
    c.hiringRepetitiveRoles && 3,
    c.affectedByObligation?.length && 3,
    c.growing && 2,
    c.outdatedWebsite && 1,
    c.noOnlineBookingOrForms && 1,
    c.oldTechStack && 1,
    c.slowServiceReviews && 1,
    c.newManager && 1,
  ].filter((x): x is number => typeof x === "number");
  const need = Math.min(10, needSignals.reduce((a, b) => a + b, 0));

  // reach (0–10)
  const reach = Math.min(10, (c.consentedEmail ? 5 : 0) + (c.decisionMakerKnown ? 3 : 0) + (c.publicEmailOrPhone ? 2 : 0));

  const parts = { fit, need, reach };
  const total = COMPANY_CRITERIA.reduce((s, cr) => s + (parts[cr.id as keyof typeof parts] / 10) * cr.weight, 0);
  return { total: round(total, 1), criterionScores: parts };
}

/** Daily list for the CRM: best first, never more than the budget allows. */
export function dailyList(companies: CompanySignals[], market: Market, cap = AGENT_BUDGETS.company.maxCompaniesPerDay) {
  return companies
    .map((c) => ({ ...c, ...scoreCompany(c, market) }))
    .filter((c) => c.criterionScores.fit >= 5)
    .sort((a, b) => b.total - a.total)
    .slice(0, cap);
}
