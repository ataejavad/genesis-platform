import { coverage, divisionNumber } from "./nace";

/**
 * Agent 4: regulatory opportunity radar (Javad's idea, 2026-10-23; doc 13 §2.6 ی).
 * Laws that force companies to adopt technology by a deadline are demand we don't have to create.
 * This registry is the radar's memory: the weekly run (prompts/regulatory-radar.md) adds and
 * re-checks entries, and the industry agent reads it for its "new regulation" criterion.
 * Every date here was checked against the cited source on `checked`.
 */

export type Obligation = {
  id: string;
  name: string;
  law: string;
  // ISO country codes, or "EU" for every member state
  countries: string[];
  // NACE codes or ranges as Eurostat writes them ("C10", "H49-H53", "C"); "ALL" for every industry
  nace: string[];
  // smallest firm size (staff) the duty reaches, and an optional turnover floor in EUR
  minStaff: number;
  minTurnoverEur?: number;
  deadline: string; // ISO date the duty bites (or bit)
  later?: { date: string; who: string }[];
  // 1 = fine is small or enforcement soft, 3 = large fines / sales ban / personal liability
  severity: 1 | 2 | 3;
  whatFirmsMustDo: string;
  readySolutions: string[];
  ourOffer: string;
  source: string;
  checked: string;
};

export const OBLIGATIONS: Obligation[] = [
  {
    id: "de-einvoice-issue",
    name: "Germany: B2B e-invoices (issuing)",
    law: "Wachstumschancengesetz, §14 UStG",
    countries: ["DE"],
    nace: ["ALL"],
    minStaff: 0,
    minTurnoverEur: 800_000,
    deadline: "2027-01-01",
    later: [{ date: "2028-01-01", who: "all other firms (Kleinunternehmer exempt from issuing)" }],
    severity: 2,
    whatFirmsMustDo: "Issue structured e-invoices (XRechnung / ZUGFeRD); receiving is already mandatory since 2025-01-01",
    readySolutions: ["lexoffice", "sevDesk", "DATEV", "ERP add-ons (ZUGFeRD)"],
    ourOffer: "E-invoice switch-over: connect existing ERP/accounting, automate inbound invoice capture with AI",
    source: "https://www.advisori.de/en/blog/e-invoicing-mandate-germany",
    checked: "2026-10-23",
  },
  {
    id: "eu-vida",
    name: "EU: e-invoicing for cross-border B2B (ViDA)",
    law: "VAT in the Digital Age package (Directive (EU) 2025/516)",
    countries: ["EU"],
    nace: ["ALL"],
    minStaff: 0,
    deadline: "2030-07-01",
    severity: 2,
    whatFirmsMustDo: "Structured e-invoice + near-real-time digital reporting for intra-EU B2B supplies",
    readySolutions: ["Peppol access points", "ERP e-invoicing modules"],
    ourOffer: "Same e-invoicing stack, extended to cross-border reporting",
    source: "https://www.truecommerce.com/blog/vida-e-invoicing-requirements/",
    checked: "2026-10-23",
  },
  {
    id: "de-nis2",
    name: "Germany: NIS2 cybersecurity duties",
    law: "NIS2UmsuCG (in force 2025-12-06)",
    countries: ["DE"],
    nace: ["D35", "E36-E39", "H49-H53", "J61", "J62", "J63", "C10-C11", "C20", "C21", "C26-C30", "C32", "M72", "Q86"],
    minStaff: 50,
    deadline: "2025-12-06",
    severity: 3,
    whatFirmsMustDo: "Register with BSI, risk management measures, incident reporting within 24 h, management liability",
    readySolutions: ["ISMS tools (e.g. Secjur, DataGuard)", "managed SOC / MDR", "backup and patch services"],
    ourOffer: "NIS2 readiness package: gap check, ISMS tool, managed security partner, monthly report",
    source: "https://www.ihk.de/darmstadt/produktmarken/digitalisierung/datenschutz-und-it-sicherheit2/nis-2-pflichten-fuer-unternehmen-6218248",
    checked: "2026-10-23",
  },
  {
    id: "it-nis2",
    name: "Italy: NIS2 cybersecurity duties",
    law: "D.Lgs. 138/2024 (ACN)",
    countries: ["IT"],
    nace: ["D35", "E36-E39", "H49-H53", "J61", "J62", "J63", "C10-C11", "C20", "C21", "C26-C30", "C32", "M72", "Q86"],
    minStaff: 50,
    deadline: "2024-10-16",
    severity: 3,
    whatFirmsMustDo: "Yearly registration on the ACN portal, baseline security measures, incident reporting",
    readySolutions: ["ISMS tools", "managed SOC / MDR"],
    ourOffer: "NIS2 readiness package (Italian)",
    source: "D.Lgs. 138/2024 (Gazzetta Ufficiale 2024-10-01, in force 2024-10-16); ACN NIS portal",
    checked: "2026-10-23",
  },
  {
    id: "eu-eudr",
    name: "EU: deforestation-free supply chains (EUDR)",
    law: "Regulation (EU) 2023/1115 as amended by 2025/2650",
    countries: ["EU"],
    nace: ["C10", "C11", "C15", "C16", "C17", "C18", "C22", "C31", "G46"],
    minStaff: 50,
    deadline: "2026-12-30",
    later: [{ date: "2027-06-30", who: "micro and small operators" }],
    severity: 3,
    whatFirmsMustDo: "Due-diligence statement with geolocation of origin for cattle, cocoa, coffee, palm oil, rubber, soy, wood",
    readySolutions: ["EUDR compliance platforms (e.g. Osapiens, Sourcemap, Koltiva)"],
    ourOffer: "EUDR set-up: supplier data collection, platform, filing routine",
    source: "https://www.stibbe.com/publications-and-insights/the-amended-eudr-what-has-changed-and-what-has-remained",
    checked: "2026-10-23",
  },
  {
    id: "eu-battery-passport",
    name: "EU: battery passport",
    law: "Batteries Regulation (EU) 2023/1542",
    countries: ["EU"],
    nace: ["C27", "C29", "C30", "G45", "G46"],
    minStaff: 0,
    deadline: "2027-02-18",
    severity: 3,
    whatFirmsMustDo: "Digital passport (QR) for EV, light-transport (e-bike) and industrial > 2 kWh batteries placed on the market",
    readySolutions: ["DPP platforms (e.g. Circularise, Spherity, Minespider)"],
    ourOffer: "Battery passport set-up with a DPP platform and data from suppliers",
    source: "https://circulareconomy.europa.eu/node/10371",
    checked: "2026-10-23",
  },
  {
    id: "eu-ai-act-high-risk",
    name: "EU: AI Act high-risk duties (Annex III, e.g. AI in hiring)",
    law: "Regulation (EU) 2024/1689 as amended by the Digital Omnibus on AI",
    countries: ["EU"],
    nace: ["N78", "P85"],
    minStaff: 0,
    deadline: "2027-12-02",
    later: [{ date: "2028-08-02", who: "AI in products under Annex I (machinery, medical devices…)" }],
    severity: 3,
    whatFirmsMustDo: "Deployers of high-risk AI: human oversight, logging, staff AI literacy, information to people affected",
    readySolutions: ["AI governance tools", "vendor compliance documentation"],
    ourOffer: "AI compliance check of tools in use + governance routine",
    source: "https://www.orrick.com/en/Insights/2026/05/EUs-Digital-Omnibus-on-AI-7-Key-Changes-You-Need-to-Know",
    checked: "2026-10-23",
  },
  {
    id: "eu-accessibility-act",
    name: "EU: European Accessibility Act",
    law: "Directive (EU) 2019/882",
    countries: ["EU"],
    nace: ["G47", "H49-H51", "J58", "J61"],
    minStaff: 10,
    deadline: "2025-06-28",
    severity: 2,
    whatFirmsMustDo: "Accessible online shops, booking/ticketing, e-books and telecom services (micro service firms exempt)",
    readySolutions: ["accessibility audit + remediation tools"],
    ourOffer: "Accessibility audit and fix of shop/booking site",
    source: "https://eur-lex.europa.eu/eli/dir/2019/882/oj",
    checked: "2026-10-23",
  },
];

const MONTH = 30.44 * 24 * 3600 * 1000;

/** How much a deadline pushes firms to buy now: highest just before it bites, still strong in the first year after. */
export function urgency(deadline: string, today = new Date()) {
  const months = (new Date(deadline).getTime() - today.getTime()) / MONTH;
  if (months >= 0 && months <= 18) return 1;
  if (months > 18 && months <= 36) return 0.6;
  if (months > 36) return 0.2;
  if (months < 0 && months >= -12) return 0.7;
  return 0.3;
}

/** Does the duty reach firms of `maxStaff` or fewer staff (our 20–249 target) in this country and industry? */
export function applies(o: Obligation, country: string, division: string, maxStaff = 249) {
  if (!o.countries.includes(country) && !(o.countries.includes("EU") && EU.has(country))) return false;
  if (o.minStaff > maxStaff) return false;
  if (o.nace.includes("ALL")) return true;
  const n = divisionNumber(division);
  return n !== null && o.nace.some((code) => coverage(code)?.includes(n));
}

/**
 * Regulation pressure for one industry in one country, for firms of 20–249 staff:
 * sum of severity × urgency of every obligation that reaches them. Feeds the industry agent.
 */
export function regulationPressure(country: string, division: string, today = new Date(), registry = OBLIGATIONS) {
  const hits = registry.filter((o) => applies(o, country, division));
  const value = hits.reduce((s, o) => s + o.severity * urgency(o.deadline, today), 0);
  return { value: Math.round(value * 10) / 10, obligations: hits.map((o) => o.id) };
}

const EU = new Set(["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"]);
