import Anthropic from "@anthropic-ai/sdk";
import { meter } from "./meter";
import type { Report } from "@/server/checkup";

/*
 * Optional: Claude writes a short, personal summary of an unlocked check-up report. Off until ANTHROPIC_API_KEY
 * is set; without it the report page shows a fixed template sentence built from the same numbers.
 * It may only restate numbers already in the report (no new claims, no prices that are not in the catalogue).
 */
export const adviceEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

const LANG: Record<string, string> = { it: "Italian", en: "English", fa: "Persian", de: "German" };

export async function writeAdvice(report: Report): Promise<string | null> {
  if (!adviceEnabled()) return null;
  const client = new Anthropic({ timeout: 20_000, maxRetries: 1 });
  const message = await client.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    output_config: { effort: "low" },
    messages: [
      {
        role: "user",
        content: `Write 3 short sentences in ${LANG[report.lang] ?? "English"} for the owner of a small ${report.industry} firm in ${report.country}, summarising this check-up: the biggest leak, what to do first, and one deadline if any. Use only the numbers and facts below; do not invent figures, names or prices. Plain text, no headings, no hype.\n\n${JSON.stringify({ total: report.total, payrollPct: report.payrollPct, leaks: report.leaks.map((l) => ({ title: l.title, amount: l.amount, payback: l.payback })), deadlines: report.deadlines.map((d) => ({ title: d.title, date: d.date })) })}`,
      },
    ],
  });
  meter(message.usage);
  if (message.stop_reason === "refusal") return null;
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
  return text || null;
}
