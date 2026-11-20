import { existsSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { researchCompany, researchEnabled } from "../src/agents/company-research";
import { companySearchFromEnv } from "../src/agents/company-finder";
import { type Imported, runOutbound, type Target } from "../src/agents/outbound";
import { peopleSearchFromEnv } from "../src/agents/decision-maker";
import { llm } from "../src/providers/llm";
import { AGENT_BUDGETS } from "../src/server/market-selection/criteria";

/*
 * Outbound agents, one run (doc 15 §6ب گام ۴). npm run agents:outbound -- [--industry metal] [--limit 20] [--import list.json] [--dry]
 *  1. company finder: COMPANY_SEARCH_PROVIDER (Google Maps via Apify with APIFY_TOKEN), or a list you import (JSON array, see docs/outbound.md)
 *  2. scorer: fit × need × reach (market selection), only fit ≥ 5, best first, daily cap from criteria.ts
 *  3. decision-maker finder: PEOPLE_SEARCH_PROVIDER (Apollo with APOLLO_API_KEY), optional
 *  4. company research: the AI model (LLM_PROVIDER) reads the public footprint, writes the page facts, persona and opening line, optional
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

const targets = (JSON.parse(readFileSync("data/outreach/targets.json", "utf8")) as { targets: Target[] }).targets.filter((t) => !values.industry || t.industry === values.industry);

const finder = companySearchFromEnv();
const people = peopleSearchFromEnv();
console.log(`outbound: finder ${finder?.provider ?? (values.import ? "import" : "off")}, people ${people?.provider ?? "off"}, research ${researchEnabled() ? llm().provider : "template"}`);
const auth = { authorization: `Bearer ${key}` };
// hard gate: a market filter Javad paused in Cockpit › Markets stops the finder for that division
const paused = values.dry || !key ? [] : await fetch(`${appUrl}/api/v1/market-filters`, { headers: auth }).then((r) => r.json() as Promise<{ paused?: string[] }>).then((r) => r.paused ?? []).catch(() => [] as string[]);
// company research spends AI-model money: only while the agent is on and under its monthly budget (cockpit)
const gate = values.dry ? { allowed: true, lessons: [] } : await fetch(`${appUrl}/api/v1/agents/runs?agent=company-research`, { headers: auth }).then((r) => r.json() as Promise<{ allowed?: boolean; lessons?: string[] }>).catch(() => ({ allowed: true, lessons: [] as string[] }));
if (values.import && !existsSync(values.import)) throw new Error(`no file ${values.import}`);
const imported = values.import ? (JSON.parse(readFileSync(values.import, "utf8")) as Imported[]) : undefined;

const summary = await runOutbound(targets, {
  finder, people, paused,
  research: researchEnabled() && gate.allowed !== false ? { lessons: gate.lessons ?? [], run: researchCompany } : null,
  researchProvider: llm().provider,
  // agents never write to the database: each company goes to the CRM through the API (scope crm:write)
  save: async (body) => {
    const res = await fetch(`${appUrl}/api/v1/prospects`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(body) });
    const out = (await res.json()) as { duplicate?: boolean; touches?: number; error?: { message: string } };
    return res.ok ? { ok: true, duplicate: out.duplicate, touches: out.touches } : { ok: false, error: `${res.status} ${out.error?.message}` };
  },
  log: console.log,
}, { limit, imported, dry: values.dry, concurrency: 2 });
for (const s of summary.skipped) console.log(s);
console.log(`done: ${summary.added} new companies, ${summary.duplicates} already in CRM, ${summary.failed} failed, about €${summary.costEur}`);
