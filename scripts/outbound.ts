import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { researchCompany, researchEnabled } from "../src/agents/company-research";
import { EUR_PER_PLACE, type Found, finderEnabled, findPlaces, toSignals } from "../src/agents/company-finder";
import { apolloEnabled, findPeople } from "../src/agents/decision-maker";
import { AGENT_BUDGETS } from "../src/server/market-selection/criteria";
import { scoreCompany } from "../src/server/market-selection/company-agent";

/*
 * Outbound agents, one run (doc 15 §6ب گام ۴). npm run agents:outbound -- [--industry metal] [--limit 20] [--import list.json] [--dry]
 *  1. company finder: Google Maps via Apify (APIFY_TOKEN), or a list you import (JSON array, see docs/outbound.md)
 *  2. scorer: fit × need × reach (market selection), only fit ≥ 5, best first, daily cap from criteria.ts
 *  3. decision-maker finder: Apollo (APOLLO_API_KEY), optional
 *  4. company research: Claude reads the public footprint, writes the page facts, persona and opening line (ANTHROPIC_API_KEY), optional
 *  5. sends each company to the CRM through the API (OUTBOUND_AGENT_KEY, scope crm:write): page + sequence as drafts for Javad
 * Every step without its key falls back to the free path, so the chain always runs end to end.
 */
try {
  process.loadEnvFile?.(".env");
} catch {
  // no .env: keys come from the environment
}
const { values } = parseArgs({ options: { industry: { type: "string" }, limit: { type: "string" }, import: { type: "string" }, dry: { type: "boolean" } } });
const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
// local mode (npm run local) leaves a fresh key for this agent; on the server it comes from the environment
const key = process.env.OUTBOUND_AGENT_KEY ?? (existsSync(".localdb/outbound-agent.key") ? readFileSync(".localdb/outbound-agent.key", "utf8").trim() : undefined);
if (!values.dry && !key) throw new Error("OUTBOUND_AGENT_KEY is not set (npm run apikey:create -- --name company-finder --scopes crm:write)");
const limit = Math.min(Number(values.limit ?? AGENT_BUDGETS.company.maxCompaniesPerDay), AGENT_BUDGETS.company.maxCompaniesPerDay);

type Target = { industry: string; country: string; nace: string; language: string; searches: string[]; regions: string[]; decisionMakerTitles: string[] };
type Imported = Found & { industry?: string; contacts?: { name?: string; role?: string; email?: string; phone?: string; linkedinUrl?: string; legalBasis?: string; basisSource?: string }[] };
const targets = (JSON.parse(readFileSync("data/outreach/targets.json", "utf8")) as { targets: Target[] }).targets.filter((t) => !values.industry || t.industry === values.industry);

console.log(`outbound: finder ${finderEnabled() ? "Apify" : values.import ? "import" : "off"}, people ${apolloEnabled() ? "Apollo" : "off"}, research ${researchEnabled() ? "Claude" : "template"}`);
let added = 0;
for (const t of targets) {
  let found: Imported[] = [];
  let spent = 0;
  if (values.import) {
    if (!existsSync(values.import)) throw new Error(`no file ${values.import}`);
    found = (JSON.parse(readFileSync(values.import, "utf8")) as Imported[]).filter((c) => (c.industry ?? t.industry) === t.industry);
  } else if (finderEnabled()) {
    const per = Math.max(5, Math.ceil((limit * 2) / (t.searches.length * t.regions.length)));
    for (const s of t.searches)
      for (const r of t.regions) {
        try {
          const places = await findPlaces(s, r, t.country, per);
          spent += places.length * EUR_PER_PLACE;
          found.push(...places.filter((p) => !p.permanentlyClosed).map((p) => toSignals(p, { nace: t.nace, region: r })));
        } catch (err) {
          console.error(`   ${s} / ${r}: ${(err as Error).message}`);
        }
      }
  } else {
    console.log(`${t.industry}-${t.country}: skipped (no APIFY_TOKEN and no --import file)`);
    continue;
  }
  const seen = new Set<string>();
  const best = found
    .filter((c) => !seen.has((c.website ?? c.name).toLowerCase()) && seen.add((c.website ?? c.name).toLowerCase()))
    .map((c) => ({ c, ...scoreCompany({ ...c, nace: c.nace ?? t.nace }, { nace: [t.nace.split(".")[0]], regions: t.regions }) }))
    .filter((x) => x.criterionScores.fit >= 5)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
  console.log(`${t.industry}-${t.country}: ${found.length} found, ${best.length} kept`);

  for (const { c, total, criterionScores } of best) {
    // the whole Apify run is spread over the companies we keep: that is what finding one really cost
    let cost = spent / best.length;
    const contacts = [...(c.contacts ?? []).map((x) => ({ ...x, source: values.import ? "list" : "manual" }))];
    const domain = c.website?.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    if (!contacts.length && apolloEnabled() && domain) {
      try {
        contacts.push(...(await findPeople(domain, t.decisionMakerTitles)));
      } catch (err) {
        console.error(`   ${c.name}: Apollo ${(err as Error).message}`);
      }
    }
    if (!contacts.length) contacts.push({ role: t.decisionMakerTitles[0], phone: c.phone, source: "maps" } as never);
    let research: Awaited<ReturnType<typeof researchCompany>> | null = null;
    if (researchEnabled()) {
      try {
        research = await researchCompany({ name: c.name, website: c.website, city: c.city, industry: t.industry, country: t.country, signals: c as unknown as Record<string, unknown> });
        cost += research.costEur;
      } catch (err) {
        console.error(`   ${c.name}: research ${(err as Error).message}`);
      }
    }
    const signals = { ...c, seenAt: new Date().toISOString().slice(0, 10) } as Record<string, unknown>;
    for (const k of ["name", "website", "phone", "nace", "region", "city", "contacts", "industry"]) delete signals[k];
    const body = {
      name: c.name, website: c.website, phone: c.phone, industry: t.industry, country: t.country, region: c.region, city: c.city, nace: c.nace ?? t.nace,
      staff: c.staff, source: values.import ? "import" : "maps", signals, score: total, criterionScores, contacts,
      ...(research ? { page: { facts: research.facts, persona: research.persona }, personal: research.personal } : {}),
      cost: { eur: Math.round(cost * 10000) / 10000, meta: { apify: !values.import, apollo: apolloEnabled(), claude: Boolean(research) } },
    };
    if (values.dry) {
      console.log(`   ${total.toFixed(1)} ${c.name} (${c.city ?? "?"}) fit ${criterionScores.fit} need ${criterionScores.need}`);
      continue;
    }
    const res = await fetch(`${appUrl}/api/v1/prospects`, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(body) });
    const out = (await res.json()) as { duplicate?: boolean; touches?: number; error?: { message: string } };
    if (!res.ok) console.error(`   ${c.name}: ${res.status} ${out.error?.message}`);
    else if (!out.duplicate) added++;
    console.log(`   ${c.name}: ${res.ok ? (out.duplicate ? "already in CRM" : `added, ${out.touches} steps waiting for approval`) : "failed"}`);
  }
}
console.log(`done: ${added} new companies`);
