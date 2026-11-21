import { z } from "zod";
import type { Cta, MediaTheme } from "@/config/media";
import { ask, extractJson, llmEnabled } from "@/providers/llm";

/*
 * Media writer (weekly, doc 11). Writes the week's LinkedIn posts for Javad's personal profile, one short YouTube
 * script and the newsletter issue per language. Uses web search for fresh industry news; every news piece names its
 * source and gives OUR impact analysis (never a paraphrase of someone else's article, Javad 2026-10-22).
 * Our own marketing text with aggregate numbers only: no personal data, so a free-tier model is fine.
 * Without a model the rule-based fallback in src/server/media.ts builds posts from the hub research.
 */

export const writerEnabled = () => llmEnabled({ webSearch: true });

const LANG_NAME: Record<string, string> = { it: "Italian", en: "English", de: "German", fa: "Persian" };

const piece = z.object({
  index: z.number().int().min(0).max(20),
  title: z.string().min(3).max(140),
  text: z.string().min(80).max(2600),
  textFa: z.string().min(20).max(4000),
  sourceUrl: z.url().max(500).nullish(),
  sourceTitle: z.string().max(200).nullish(),
});
export const writerSchema = z.object({
  linkedin: z.array(piece).max(8),
  youtube: z.array(piece).max(3),
  newsletter: z.array(z.object({ lang: z.string().length(2), subject: z.string().min(5).max(140), text: z.string().min(200).max(9000), summaryFa: z.string().min(20).max(1500) })).max(4),
});
export type WriterOut = z.infer<typeof writerSchema>;

export type WriterInput = {
  today: string;
  brand: string;
  founder: string;
  focus: { industry: string; country: string; name: string };
  plan: { channel: "linkedin" | "youtube"; index: number; theme: MediaTheme; lang: string; cta: Cta }[];
  newsletterLangs: string[];
  /** sector problems from our hub research, with their sources */
  pains: { text: string; source?: string }[];
  /** news our hub research already found (seeds; search for fresher ones) */
  news: { date: string; publisher: string; url: string; title: string; takeaway: string }[];
  /** what the company did in the last 7 days, aggregate numbers only (for "build in public") */
  week: Record<string, number | string>;
  /** titles already used (do not repeat) and titles Javad rejected with his note (learn from them) */
  used: string[];
  rejected: { title: string; note: string | null }[];
};

const instructions = (i: WriterInput) => `You write the weekly media of ${i.brand}, a small EU company that removes the problems that cost small firms time
and money and is paid for the result (we sell outcomes, never software, tools or "AI tokens"). Today is ${i.today}.
Audience focus: ${i.focus.name} in ${i.focus.country}. Posts go on the PERSONAL LinkedIn profile of the founder, ${i.founder}, in the first person.

Write these pieces (one per line, keep the index):
${i.plan.map((p) => `- ${p.channel} #${p.index}: theme "${p.theme}", language ${LANG_NAME[p.lang] ?? p.lang}, ends by inviting to ${p.cta === "checkup" ? "the free 3-minute check-up" : "the weekly newsletter"}`).join("\n")}
- newsletter issue in each of: ${i.newsletterLangs.map((l) => LANG_NAME[l] ?? l).join(", ")}

Themes:
- news: use web search to find ONE concrete news item from the last 14 days that matters to ${i.focus.name} in ${i.focus.country}
  (a rule, an incentive, a deadline, a new technology, a market number). Give its sourceUrl and sourceTitle. Write OUR take: what it
  changes for a small firm, who should act, what to do this month. Never copy or paraphrase the article's sentences; one short fact is fine.
- pain: one real problem of these firms (see the list), told as a short scene with a number, and how it is solved today.
- build: building this company in public with a small team and AI agents doing most of the work: one honest lesson or number from this week.
- newsletter: the hub of all of it. Subject line + plain-text body (no HTML, no markdown tables): 1 new technology or rule and how to use it,
  1 number from the industry, 1 short story from our work, 1 question to the readers. Sources as plain URLs at the end of their section.

Rules for every LinkedIn post: hook in the first line (under 12 words), short paragraphs, 600–1300 characters, max 3 hashtags at the end,
no links inside the text (we add the link), no emojis walls, no hype words ("revolutionary", "game-changer"), no promises we cannot keep,
plain words a busy business owner understands. YouTube script: 45–60 seconds spoken, a hook in 3 seconds, one problem, one fix, one call
to action; mark [SHOT] for what to show. Write each text in its language; textFa is a faithful Persian translation for the founder's review.

Sector problems we researched:
${i.pains.map((p) => `- ${p.text}${p.source ? ` (${p.source})` : ""}`).join("\n") || "- (none yet)"}

News we already know (use only if still fresh, prefer newer):
${i.news.map((n) => `- ${n.date} ${n.publisher}: ${n.title} ${n.url}`).join("\n") || "- (none)"}

This week in our company (aggregate numbers, for the build theme): ${JSON.stringify(i.week)}

Already used, do not repeat: ${i.used.join(" | ") || "none"}
The founder rejected these before; avoid what made them weak: ${i.rejected.map((r) => `"${r.title}"${r.note ? ` (note: ${r.note})` : ""}`).join("; ") || "none"}

Reply with one JSON object in a \`\`\`json block:
{"linkedin":[{"index","title" (internal, short),"text","textFa","sourceUrl","sourceTitle"}],
 "youtube":[{"index","title","text","textFa"}],
 "newsletter":[{"lang" (two letters),"subject","text","summaryFa" (3 lines in Persian)}]}`;

export async function writeWeek(input: WriterInput): Promise<WriterOut> {
  const text = await ask({ maxTokens: 24000, webSearch: { maxUses: 8 }, timeoutMs: 75_000, messages: [{ role: "user", content: instructions(input) }] }, "media week");
  return writerSchema.parse(extractJson(text, "{"));
}
