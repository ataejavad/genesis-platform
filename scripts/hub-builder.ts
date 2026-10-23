import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { researchEnabled, researchHub } from "../src/agents/hub-research";
import { type HubIssue, hubDrafts, loadFacts, loadResearch } from "../src/server/hubs";

/*
 * Hub-builder agent (doc 15 §6ه.2). npm run agents:hubs [-- --research] [-- --dry]
 *  1. (--research, only with ANTHROPIC_API_KEY) Claude re-checks the research on the web and saves a new dated file.
 *  2. Applies the sourcing rules, builds one page per locale and sends each as a draft through the API.
 * Needs APP_URL and HUB_AGENT_KEY (npm run apikey:create -- --name hub-builder --scopes content:draft).
 * Unchanged pages are not re-sent for approval, so it is safe to run on every start and on a schedule.
 */
const { values } = parseArgs({ options: { research: { type: "boolean" }, dry: { type: "boolean" } } });
const now = new Date();
const today = now.toISOString().slice(0, 10);
const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const key = process.env.HUB_AGENT_KEY;
if (!values.dry && !key) throw new Error("HUB_AGENT_KEY is not set (scope content:draft)");

let hubs = loadResearch();
if (values.research) {
  if (!researchEnabled()) {
    console.log("research step skipped: no ANTHROPIC_API_KEY yet; using the newest research files");
  } else {
    for (const prev of hubs) {
      try {
        const { research, usage } = await researchHub(prev, now);
        mkdirSync(`data/hubs/research/${today}`, { recursive: true });
        writeFileSync(`data/hubs/research/${today}/${research.industry}-${research.country.toLowerCase()}.json`, `${JSON.stringify(research, null, 2)}\n`);
        console.log(`researched ${prev.industry}-${prev.country}: ${usage.input} in / ${usage.output} out tokens, ${usage.searches} searches`);
      } catch (err) {
        // A failed research run keeps the last approved facts; it never blanks a hub.
        console.error(`research failed for ${prev.industry}-${prev.country}: ${(err as Error).message}`);
      }
    }
    hubs = loadResearch();
  }
}

const show = (i: HubIssue) => `   ${i.level === "error" ? "✗" : i.level === "dropped" ? "–" : "!"} ${i.where}: ${i.why}`;
let failed = 0;
for (const research of hubs) {
  const name = `${research.industry}-${research.country}`;
  const facts = loadFacts(research);
  const { drafts, issues } = hubDrafts(research, facts, now);
  console.log(`${name}: research ${research.researchedAt}, facts ${facts ? facts.period : "missing"}, ${drafts.length} pages`);
  issues.forEach((i) => console.log(show(i)));
  if (!drafts.length) failed++;
  if (values.dry) continue;
  for (const draft of drafts) {
    const res = await fetch(`${appUrl}/api/v1/drafts`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    const body = (await res.json()) as { version?: number; unchanged?: boolean; error?: { message: string } };
    if (!res.ok) {
      failed++;
      console.error(`   ${draft.locale}/${draft.slug}: ${res.status} ${body.error?.message}`);
    } else {
      console.log(`   ${draft.locale}/${draft.slug}: ${body.unchanged ? "unchanged" : `v${body.version} waiting for approval`}`);
    }
  }
}
if (failed) process.exitCode = 1;
