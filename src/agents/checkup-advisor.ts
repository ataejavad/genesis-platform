import { llm, llmEnabled } from "@/providers/llm";
import type { Report } from "@/server/checkup";

/*
 * Optional: Claude writes a short, personal summary of an unlocked check-up report. Off until an AI model
 * is connected; without it the report page shows a fixed template sentence built from the same numbers.
 * It may only restate numbers already in the report (no new claims, no prices that are not in the catalogue).
 */
export const adviceEnabled = () => llmEnabled();

const LANG: Record<string, string> = { it: "Italian", en: "English", fa: "Persian", de: "German" };

export async function writeAdvice(report: Report): Promise<string | null> {
  if (!adviceEnabled()) return null;
  const r = await llm().complete({
    maxTokens: 2000,
    effort: "low",
    timeoutMs: 20_000,
    messages: [
        {
          role: "user",
          content: `Write 3 short sentences in ${LANG[report.lang] ?? "English"} for the owner of a small ${report.industry} firm in ${report.country}, summarising this check-up: the biggest leak, what to do first, and one deadline if any. Use only the numbers and facts below; do not invent figures, names or prices. Plain text, no headings, no hype.\n\n${JSON.stringify({ total: report.total, payrollPct: report.payrollPct, leaks: report.leaks.map((l) => ({ title: l.title, amount: l.amount, payback: l.payback })), deadlines: report.deadlines.map((d) => ({ title: d.title, date: d.date })) })}`,
        },
      ],
  });
  if (r.stop === "refusal") return null;
  return r.text.trim() || null;
}
