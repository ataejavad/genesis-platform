import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { meter } from "./meter";

/*
 * AI-capability scout (monthly). The AI wave moves faster than our plans: each month Claude searches the web for
 * models and tools released in the last ~45 days that could (1) take over a step a person does today, (2) do a
 * partner task in one of our packages for less, or (3) become a new packaged product for our industries.
 * Candidates are proposals only: they land as inactive lessons (area "ai-scout") that Javad switches on to adopt.
 * Off until ANTHROPIC_API_KEY is set.
 */

export const scoutEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

const MODEL = "claude-opus-5-5";

export const candidateSchema = z.object({
  name: z.string().min(2).max(120),
  url: z.string().url(),
  released: z.string().max(20),
  kind: z.enum(["step", "partner_task", "new_product"]),
  /** process-map step id, package slug/task title, or industry for a new product */
  replaces: z.string().min(2).max(200),
  what: z.string().min(10).max(600),
  costEurMonth: z.number().min(0).max(100000),
  savesEurMonth: z.number().min(0).max(1000000),
  /** GDPR / EU hosting / AI Act / vendor risk, in one line */
  risk: z.string().max(300),
  confidence: z.enum(["low", "medium", "high"]),
});
export type Candidate = z.infer<typeof candidateSchema>;

export type ScoutInput = {
  humanSteps: { id: string; does: string; agentHow?: string }[];
  packages: { slug: string; title: string; tasks: { title: string; payEur: number }[] }[];
  industries: string[];
  known: string[];
};

const instructions = (i: ScoutInput, today: string) => `You are the AI-capability scout of a small EU company that sells outcomes (not software) to SMEs and delivers them
with partners and AI agents. Today is ${today}. Using web search, find AI models, agents or tools released or substantially
improved in the last 45 days that could, within our means (a few hundred € per month, EU data processing possible):
1. take over one of the steps a person does today (list A), or
2. do one of the partner tasks in our packages for clearly less money at the same quality (list B), or
3. become a new outcome we could package for our industries (${i.industries.join(", ") || "SMEs"}).

A. Steps a person does today:
${i.humanSteps.map((s) => `- ${s.id}: ${s.does}${s.agentHow ? ` (our plan: ${s.agentHow})` : ""}`).join("\n")}

B. Packages and partner tasks (what we pay per task):
${i.packages.map((p) => `- ${p.slug} "${p.title}": ${p.tasks.map((t) => `${t.title} €${t.payEur}`).join("; ")}`).join("\n")}

Already known, do not repeat: ${i.known.join(", ") || "none"}.

Rules: only things you can confirm from the maker's own page or two independent sources; prefer what works today over
announcements; say plainly when EU hosting or a DPA is not available. At most 5 candidates, best value first; fewer is fine.
Reply with one JSON array in a \`\`\`json block, each item:
{"name","url","released" (YYYY-MM-DD),"kind" ("step"|"partner_task"|"new_product"),"replaces" (step id, package slug + task, or industry),
"what" (one or two sentences: what it does for us),"costEurMonth","savesEurMonth","risk","confidence" ("low"|"medium"|"high")}`;

function extractJson(text: string): unknown {
  const fenced = [...text.matchAll(/```json\s*([\s\S]*?)```/g)].at(-1)?.[1];
  return JSON.parse(fenced ?? text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));
}

export async function scout(input: ScoutInput, now = new Date()): Promise<Candidate[]> {
  const client = new Anthropic();
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: instructions(input, now.toISOString().slice(0, 10)) }];
  // Server-side web search can pause a long turn; resume it a few times before giving up.
  for (let turn = 0; turn < 6; turn++) {
    const message = await client.messages
      .stream({
        model: MODEL,
        max_tokens: 32000,
        thinking: { type: "adaptive" },
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 20 }],
        messages,
      })
      .finalMessage();
    meter(message.usage);
    if (message.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: message.content });
      continue;
    }
    if (message.stop_reason === "refusal") throw new Error("scout refused by the model");
    if (message.stop_reason === "max_tokens") throw new Error("scout answer was cut off (max_tokens)");
    const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return z.array(candidateSchema).max(5).parse(extractJson(text));
  }
  throw new Error("scout did not finish after 6 turns");
}
