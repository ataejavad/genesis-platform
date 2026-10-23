import type { CountryRun } from "./country-agent";
import { COUNTRY_CRITERIA, INDUSTRY_CRITERIA } from "./criteria";
import type { IndustryRun } from "./industry-agent";
import { OBLIGATIONS, urgency } from "./regulations";

/** Markdown reports for the approval gates. English, like the cockpit (Javad's choice). */

export function countryReport(run: CountryRun) {
  const lines = [
    `# Country agent: ranking (${run.ranAt.slice(0, 10)})`,
    "",
    "Score out of 100 · confidence = share of the weight resting on real data.",
    "",
    `| # | Country | Score | Confidence | ${COUNTRY_CRITERIA.map((c) => `${c.id} (${c.weight})`).join(" | ")} |`,
    `|---|---|---|---|${COUNTRY_CRITERIA.map(() => "---").join("|")}|`,
    ...run.ranking.map((r, i) => {
      const cand = run.candidates.find((c) => c.id === r.id)!;
      const cells = r.breakdown.map((b) => (b.missing ? "–" : `${fmt(cand.values[b.id])} → ${b.points}`));
      return `| ${i + 1} | ${r.name} | **${r.total}** | ${Math.round(r.confidence * 100)}% | ${cells.join(" | ")} |`;
    }),
    "",
    "## Sources",
    ...run.candidates.map((c) => `- **${c.name}**: ${Object.entries(c.sources ?? {}).map(([k, v]) => `${k}: ${v}`).join("; ")}`),
  ];
  return lines.join("\n");
}

export function industryReport(run: IndustryRun, top = 15) {
  const facts = (id: string) => run.rows.find((r) => r.id === id)!.facts;
  const lines = [
    `# Industry agent: ${run.country} (${run.ranAt.slice(0, 10)}, statistics year ${run.period})`,
    "",
    `${run.ranking.length} industries passed the gates, ${run.dropped.length} dropped. Score out of 100; gap = automatic "market gap" index (pain × low AI use × ready solution × low competition).`,
    "",
    "| # | NACE | Industry | Score | Conf. | Gap | Firms 20–249 | Turnover M€ | Margin % | Personnel % of turnover | Vacancy % | AI use % | LQ vs EU | Obligations |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    ...run.ranking.slice(0, top).map((r, i) => {
      const f = facts(r.id);
      return `| ${i + 1} | ${r.id} | ${r.name} | **${r.total}** | ${Math.round(r.confidence * 100)}% | ${r.gap} | ${fmt(f.targetFirms)} | ${fmt(f.turnoverMeur)} | ${fmt(f.marginPct)} | ${fmt(f.personnelSharePct)} | ${fmt(f.vacancyRatePct)} | ${fmt(f.aiUsePct)} | ${fmt(f.locationQuotient)} | ${f.obligations ?? ""} |`;
    }),
    "",
    "## Waiting for deep research (top 10)",
    "These criteria are still neutral (5/10) until the research step fills them:",
    "",
    ...run.researchQueue.map((q) => `- ${q.id} ${q.name}: ${q.missing.join(", ")}`),
    "",
    "## Dropped by gates",
    ...run.dropped.map((d) => `- ${d.id} ${d.name}: ${d.reasons.join("; ")}`),
    "",
    `Criteria and weights: ${INDUSTRY_CRITERIA.map((c) => `${c.id} ${c.weight}`).join(", ")}.`,
  ];
  return lines.join("\n");
}

export function radarReport(today = new Date()) {
  const rows = [...OBLIGATIONS].sort((a, b) => urgency(b.deadline, today) * b.severity - urgency(a.deadline, today) * a.severity);
  return [
    `# Regulatory opportunity radar (${today.toISOString().slice(0, 10)})`,
    "",
    "| Obligation | Countries | Who (NACE, size) | Deadline | Severity | Urgency now | Our offer | Source |",
    "|---|---|---|---|---|---|---|---|",
    ...rows.map(
      (o) =>
        `| ${o.name} | ${o.countries.join(", ")} | ${o.nace.join(" ")}, ≥${o.minStaff} staff${o.minTurnoverEur ? `, > ${o.minTurnoverEur / 1000}k € turnover` : ""} | ${o.deadline}${o.later?.length ? ` (then ${o.later.map((l) => `${l.date}: ${l.who}`).join("; ")})` : ""} | ${o.severity} | ${urgency(o.deadline, today)} | ${o.ourOffer} | ${o.source.startsWith("http") ? `[link](${o.source})` : o.source} |`,
    ),
  ].join("\n");
}

function fmt(v: unknown) {
  if (v === null || v === undefined) return "–";
  if (typeof v === "number") return Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("en") : String(Math.round(v * 100) / 100);
  return String(v);
}
