import { z } from "zod";
import { APQC } from "@/config/radar";
import { ask, extractJson, llmEnabled } from "@/providers/llm";

/*
 * Solutions radar agent (daily, Javad 2026-11-24). Reads the day's product launches and technology news (titles +
 * the feeds' short descriptions) and picks the few that solve a real problem of the small firms we serve. For each:
 * the problem, the industries (NACE) and processes (APQC), and our move: resell it (partner / white-label), build our
 * own version, or ignore. It also writes our impact take (for hubs and the newsletter) and an English LinkedIn post.
 * Public news only, no personal data: a free-tier model is fine. No web search needed (cheaper and steadier on the
 * free tier); without a model the radar lists the items unanalysed.
 */

export const radarEnabled = () => llmEnabled();

const text = (min: number, max: number) => z.string().min(min).max(max);
export const pickSchema = z.object({
  index: z.number().int().min(0).max(500),
  maker: text(1, 120),
  problem: text(10, 400),
  useCase: text(10, 500),
  industries: z.array(z.object({ nace: text(1, 12), name: text(2, 80) })).min(1).max(6),
  processes: z.array(text(3, 80)).min(1).max(4),
  decision: z.enum(["resell", "build", "ignore"]),
  why: text(10, 500),
  fit: z.number().int().min(1).max(5),
  effort: z.enum(["low", "medium", "high"]),
  takeaway: z.object({ en: text(20, 600), it: text(20, 700).optional(), de: text(20, 700).optional() }),
  linkedin: text(200, 2000),
  summaryFa: text(20, 1500),
});
export type RadarPick = z.infer<typeof pickSchema>;

export type RadarInput = {
  today: string;
  brand: string;
  items: { index: number; source: string; title: string; summary: string; date: string | null }[];
  /** industries we serve or research now (hubs, customers), with their NACE codes */
  industries: { name: string; nace: string[] }[];
  /** packages we already sell (do not propose what we already have) */
  packages: string[];
  /** solutions already proposed in the last weeks (do not repeat) */
  seen: string[];
  /** what Javad dismissed with his note (learn from it) */
  dismissed: { title: string; note: string | null }[];
  maxPicks: number;
};

const instructions = (i: RadarInput) => `You are the solutions radar of ${i.brand}, a small EU company that removes the problems that cost small and
medium firms (5–250 people) time and money. We are a broker and integrator, not a software house: we package other
companies' tools into a result with a fixed monthly fee, or have partners build a simple version when nothing fits.
Today is ${i.today}.

Below are today's new products and technology news (title + the feed's short description). Pick the ${i.maxPicks} that
best solve a real, costly problem of SMEs (office work, sales, quotes, invoices, customer service, scheduling, compliance,
field work, hiring, marketing), best first. A product for any SME counts; it does not need to name our industries. Skip:
tools only for developers, consumer apps, games, crypto, funding rounds without a product, big-company-only software.
Return fewer only when fewer qualify; an empty list only when none of the items could help any small business.

For each pick:
- maker: the company or product name.
- problem: the business problem it removes, in one plain sentence (time or money).
- useCase: how a small firm in a named industry would use it, concretely (one or two sentences).
- industries: 1–6 NACE Rev. 2 codes where it helps most, e.g. {"nace":"F43.21","name":"Electrical installation"}.
  Prefer the industries we serve: ${i.industries.map((x) => `${x.name} (${x.nace.join(", ")})`).join("; ") || "none yet"}.
- processes: 1–4 APQC level-1 categories, exactly as written here: ${APQC.join(" | ")}.
- decision: "resell" when the maker sells to SMEs and we can add it as a partner / reseller / white-label or through its
  API; "build" when the idea is simple enough for our partners to rebuild with AI in a few weeks and the maker does not
  serve EU SMEs (US-only, enterprise-only, English-only); "ignore" otherwise. why: one or two sentences with the reason
  (pricing, EU availability, GDPR, effort) and what to check first.
- fit: 1–5, how strongly our customers need it and how easily we can sell it as a result (3 = useful for many SMEs,
  5 = a must-have for one of our industries). effort: low | medium | high.
- takeaway: OUR impact analysis for business owners (never a paraphrase of the source's sentences): what it changes
  for a small firm, who should act, what to do this month. en always; it and de as faithful translations.
- linkedin: an English LinkedIn post for our company page (600–1300 characters). First line is a hook under 12 words.
  Name the problem with a number when you have one, then our take; mention the maker and that the link is in the
  comments. Plain words, short paragraphs, no hype ("revolutionary", "game-changer"), no emoji walls, at most 3
  hashtags at the end, no links in the text. Never write "AI agent", "tokens" or "LLM" for customers: say what it does.
- summaryFa: a short Persian summary for our founder: what it is, which problem, which industries, our move and why.

Already proposed, do not repeat: ${i.seen.join(" | ") || "none"}
Packages we already sell: ${i.packages.join(" | ") || "none yet"}
Dismissed by the founder (learn from the notes): ${i.dismissed.map((d) => `${d.title}${d.note ? ` (${d.note})` : ""}`).join(" | ") || "none"}

Today's items:
${i.items.map((x) => `[${x.index}] (${x.source}${x.date ? `, ${x.date}` : ""}) ${x.title}${x.summary ? ` — ${x.summary}` : ""}`).join("\n")}

Reply with one JSON array in a \`\`\`json block: [{"index","maker","problem","useCase","industries","processes","decision","why","fit","effort","takeaway":{"en","it","de"},"linkedin","summaryFa"}]`;

export async function analyse(input: RadarInput): Promise<RadarPick[]> {
  if (!input.items.length) return [];
  const raw = extractJson(await ask({ maxTokens: 24000, effort: "low", timeoutMs: 180_000, messages: [{ role: "user", content: instructions(input) }] }, "radar answer"), "[");
  if (!Array.isArray(raw)) throw new Error("radar answer is not a list");
  // one malformed pick must not throw away the good ones
  const picks = raw.flatMap((r) => {
    const p = pickSchema.safeParse(r);
    return p.success ? [p.data] : [];
  });
  if (raw.length && !picks.length) throw new Error(`radar answer had ${raw.length} picks, none valid: ${pickSchema.safeParse(raw[0]).error?.issues[0]?.message ?? ""}`);
  return picks.filter((p) => p.index < input.items.length).slice(0, input.maxPicks);
}
