import { z } from "zod";
import { ask, extractJson, llmEnabled } from "@/providers/llm";

/*
 * AI-capability scout (monthly). The AI wave moves faster than our plans: each month Claude searches the web for
 * models and tools released in the last ~45 days that could (1) take over a step a person does today, (2) do a
 * partner task in one of our packages for less, or (3) become a new packaged product for our industries.
 * Candidates are proposals only: they land as inactive lessons (area "ai-scout") that Javad switches on to adopt.
 * Off until an AI model with web search is connected (src/providers/llm).
 */

export const scoutEnabled = () => llmEnabled({ webSearch: true });

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

export async function scout(input: ScoutInput, now = new Date()): Promise<Candidate[]> {
  const text = await ask(
    { maxTokens: 32000, thinking: true, webSearch: { maxUses: 20 }, messages: [{ role: "user", content: instructions(input, now.toISOString().slice(0, 10)) }] },
    "scout answer",
  );
  return z.array(candidateSchema).max(5).parse(extractJson(text, "["));
}
