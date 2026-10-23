import type { CountryCode } from "./criteria";

/**
 * Researched inputs for criteria that no statistics API publishes. Scale 0–10, each with its
 * source and the date it was checked. The country agent re-checks them every quarter.
 * UK left the EU, so Eurostat has no recent UK data; UK numbers come from ONS here.
 */
export type Input = { value: number | null; note: string; source?: string; checked: string };

export const COUNTRY_INPUTS: Record<CountryCode, Record<"subsidies" | "access" | "legal", Input>> = {
  IT: {
    subsidies: { value: 9, note: "Iperammortamento 2026 (Legge di bilancio 2026) covers 4.0 software; Transizione 5.0 credits; PNRR", source: "https://www.mysolution.it/fisco/informazioni/news/2026/07/10/iperammortamentosoftware-agevolabili-se-iscritti-tra-le-immobilizzazioni/", checked: "2026-10-23" },
    access: { value: 10, note: "Italian spoken; Javad registers as Italian freelancer, so invoicing is domestic", checked: "2026-10-23" },
    legal: { value: 4, note: "Cold email needs prior consent even B2B (Codice privacy art. 130); phone after checking the Registro delle Opposizioni", source: "https://www.garanteprivacy.it/web/guest/home/docweb/-/docweb-display/docweb/4207931", checked: "2026-10-23" },
  },
  DE: {
    subsidies: { value: 6, note: "No federal SME digital grant since 'go-digital' ended; state programmes (Digitalbonus Bayern, Digitalisierungsprämie BW etc.) differ by Land", source: "https://skill-sprinters.de/blog/foerderung/digitalbonus-nach-bundesland-2026/", checked: "2026-10-23" },
    access: { value: 9, note: "German covered (AI + review); EU reverse-charge invoicing from Italy", checked: "2026-10-23" },
    legal: { value: 3, note: "Cold email effectively banned B2B (UWG §7(2) Nr. 3); phone only with presumed consent", source: "https://www.ihk-muenchen.de/ratgeber/recht/werbung-fairer-wettbewerb/marketing-per-email-telefon-brief-etc/", checked: "2026-10-23" },
  },
  AT: {
    subsidies: { value: 8, note: "KMU.DIGITAL federal programme funded again in 2026 (consulting + implementation)", source: "https://www.bmwet.gv.at/Presse/Archiv/BMWET-Pressemeldungen-2026/pa-bmwet-2026-05/KMU.DIGITAL.html", checked: "2026-10-23" },
    access: { value: 9, note: "German covered; EU reverse-charge invoicing", checked: "2026-10-23" },
    legal: { value: 3, note: "TKG 2021 §174: email marketing needs prior consent, also B2B", checked: "2026-10-23" },
  },
  IE: {
    subsidies: { value: 7, note: "Grow Digital Voucher via Local Enterprise Offices (co-funds digital tools)", source: "https://localenterprise.ie/Waterford/Financial-Supports/Grow-Digital", checked: "2026-10-23" },
    access: { value: 9, note: "English; EU reverse-charge invoicing", checked: "2026-10-23" },
    legal: { value: 6, note: "B2B email to corporate addresses possible with opt-out (S.I. 336/2011); to verify with a lawyer", checked: "2026-10-23" },
  },
  UK: {
    subsidies: { value: 3, note: "Help to Grow: Digital closed in 2023; no national SME software grant found", checked: "2026-10-23" },
    access: { value: 8, note: "English; non-EU: invoicing from Italy works (B2B services outside scope of IT VAT) but adds admin", checked: "2026-10-23" },
    legal: { value: 9, note: "PECR: B2B cold email to corporate subscribers allowed with identification + opt-out", source: "https://globallawexperts.com/b2b-email-marketing-rules-uk/", checked: "2026-10-23" },
  },
};

/** UK values the Eurostat tables lack, from ONS. null = not found yet (scored neutral, lowers confidence). */
export const UK_STATS: Record<"ai_gap" | "sme_count" | "momentum" | "labour_cost", Input> = {
  momentum: { value: 1.2, note: "Real GDP Q2 2026 vs Q2 2025 (+1.2%)", source: "https://www.ons.gov.uk/economy/grossdomesticproductgdp/bulletins/gdpfirstquarterlyestimateuk/apriltojune2026", checked: "2026-10-23" },
  ai_gap: { value: null, note: "ONS BICS measures AI use differently; not comparable with Eurostat, left neutral", checked: "2026-10-23" },
  sme_count: { value: null, note: "ONS 'UK business: activity, size and location' tables by size band not parsed yet", source: "https://www.ons.gov.uk/businessindustryandtrade/business/activitysizeandlocation/datasets/ukbusinessactivitysizeandlocation", checked: "2026-10-23" },
  labour_cost: { value: null, note: "No Eurostat-comparable UK hourly labour cost since 2020", checked: "2026-10-23" },
};

/**
 * Deep-research scores (0–10) for the top industries of a country, written by the research step
 * (prompts/industry-research.md). "competition" is the level of competition: high = bad for us.
 */
export type IndustryResearch = {
  manual_work: number;
  solutions: number;
  reachability: number;
  competition: number;
  replicability: number;
  note: string;
  sources: string[];
  checked: string;
};

export const INDUSTRY_RESEARCH: Record<string, Record<string, IndustryResearch>> = {
  IT: {
    F43: {
      manual_work: 8, solutions: 8, reachability: 7, competition: 6, replicability: 9,
      note: "Installers (electrical, plumbing, HVAC, solar): paper job reports, quotes, scheduling, bonus paperwork; ready field-service tools exist; reachable via CNA, Confartigianato, Assistal; same top rank in DE; artisans shrinking",
      sources: [
        "https://www.teamsystem.com/magazine/construction/gestione-digitale-rapporti-intervento/",
        "https://www.italiaoggi.it/diritto-e-fisco/lavoro-e-previdenza/trovare-un-idraulico-o-un-elettricista-sara-sempre-piu-difficile-crollano-gli-artigiani-in-italia-a130ja46",
      ],
      checked: "2026-10-23",
    },
    H49: {
      manual_work: 8, solutions: 7, reachability: 6, competition: 6, replicability: 9,
      note: "Road haulage: transport documents (DDT/CMR), planning, driver shortage (~22,000 missing in Italy); TMS, route optimisation and document AI exist; top 3 in DE too",
      sources: ["https://quifinanza.it/lavoro/camionisti-crisi-aziende-italia/843883/"],
      checked: "2026-10-23",
    },
    C25: {
      manual_work: 8, solutions: 8, reachability: 7, competition: 5, replicability: 8,
      note: "Metal fabrication job shops: quoting from drawings by hand, many small owner-run firms, Italy specialised (LQ 1.39); automatic quoting tools exist (Radquote, Almaquote, Quotify)",
      sources: ["https://hexagon.com/it/products/radan-radquote", "https://www.itismagazine.it/tecnologie/quanto-costa-una-lavorazioni-cnc-te-lo-dice-quotify"],
      checked: "2026-10-23",
    },
    F41: {
      manual_work: 7, solutions: 6, reachability: 6, competition: 6, replicability: 7,
      note: "Building contractors: site reports, subcontractor coordination, bonus paperwork; construction suites exist (TeamSystem, ACCA) but projects are lumpy",
      sources: ["https://www.teamsystem.com/construction/bpm-service/funzionalita/"],
      checked: "2026-10-23",
    },
    I56: {
      manual_work: 6, solutions: 9, reachability: 6, competition: 9, replicability: 8,
      note: "Restaurants with 20+ staff: rota, stock, reservations; very crowded vertical SaaS market (booking, POS, rota)",
      sources: [],
      checked: "2026-10-23",
    },
    I55: {
      manual_work: 5, solutions: 9, reachability: 7, competition: 9, replicability: 7,
      note: "Hotels: PMS, channel managers and chatbots are mature and crowded; AI use already 20%",
      sources: [],
      checked: "2026-10-23",
    },
    H52: {
      manual_work: 7, solutions: 7, reachability: 6, competition: 6, replicability: 8,
      note: "Warehousing/forwarding: document handling, customs paperwork; WMS and document AI exist",
      sources: [],
      checked: "2026-10-23",
    },
  },
};
