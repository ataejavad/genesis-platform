/**
 * Runs the market-selection agents (doc 13 §2.6) on real public data and writes the reports.
 *
 *   npm run agents:market -- all                 country ranking → industries for the top 2 → radar
 *   npm run agents:market -- country
 *   npm run agents:market -- industry DE
 *   npm run agents:market -- radar
 *   add --offline to re-run from saved snapshots without network
 *
 * Output: data/market-selection/runs/<date>/*.{json,md}; raw Eurostat responses in data/market-selection/snapshots/.
 * Until n8n is up, GitHub Actions runs this on a schedule (.github/workflows/market-selection.yml).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runCountryAgent } from "../src/server/market-selection/country-agent";
import { eurostatFetcher } from "../src/server/market-selection/eurostat";
import { runIndustryAgent } from "../src/server/market-selection/industry-agent";
import { countryReport, industryReport, radarReport } from "../src/server/market-selection/report";

const args = process.argv.slice(2);
const offline = args.includes("--offline");
const [cmd = "all", arg] = args.filter((a) => !a.startsWith("--"));
const root = join(process.cwd(), "data", "market-selection");
const day = new Date().toISOString().slice(0, 10);
const out = join(root, "runs", day);
const fetcher = eurostatFetcher({ snapshotDir: join(root, "snapshots"), offline, log: (m) => console.log(m) });

async function save(name: string, json: unknown, md: string) {
  await mkdir(out, { recursive: true });
  await writeFile(join(out, `${name}.json`), JSON.stringify(json, null, 2));
  await writeFile(join(out, `${name}.md`), md + "\n");
  console.log(`wrote ${join(out, name)}.{json,md}`);
}

async function country() {
  const run = await runCountryAgent(fetcher);
  await save("country", run, countryReport(run));
  return run;
}

async function industry(code: string) {
  const run = await runIndustryAgent(fetcher, code, (m) => console.log(m));
  await save(`industry-${code}`, run, industryReport(run));
  return run;
}

async function radar() {
  await save("radar", { ranAt: new Date().toISOString() }, radarReport());
}

async function main() {
  if (cmd === "country") await country();
  else if (cmd === "industry") await industry((arg ?? "DE").toUpperCase());
  else if (cmd === "radar") await radar();
  else if (cmd === "all") {
    const c = await country();
    // UK is not in Eurostat's industry tables; the industry agent covers EU countries for now
    const top = c.ranking.map((r) => r.id).filter((id) => id !== "UK").slice(0, 2);
    for (const code of top) await industry(code);
    await radar();
  } else {
    throw new Error(`unknown command ${cmd}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
