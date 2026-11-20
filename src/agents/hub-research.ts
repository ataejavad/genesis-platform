import { extractJson, llm, llmEnabled } from "@/providers/llm";
import { type HubResearch, researchSchema } from "@/server/hubs";

/*
 * Research step of the hub-builder: Claude re-checks every rule and deadline on the web, adds recent news and
 * returns the same research format. Off until an AI model with web search is connected (src/providers/llm); until then research files are written
 * by hand (or in a Claude session) and the rest of the pipeline is identical.
 */

export const researchEnabled = () => llmEnabled({ webSearch: true });

const learned = (lessons: string[]) => (lessons.length ? `\nWhat we learned from earlier rounds (follow it):${lessons.map((l) => `\n- ${l}`).join("")}\n` : "");

const instructions = (prev: HubResearch, today: string, lessons: string[] = []) => `You keep the industry hub "${prev.industry}" (NACE ${prev.nace.join(", ")}) for country ${prev.country} up to date.
Today is ${today}. Below is the current research file. Using web search:
1. Re-check every deadline and rule. Keep only items you can confirm from an official source (EU, ministry, agency, official gazette) or from two independent publishers. Correct dates, rates and thresholds that changed. Drop items whose date passed more than 30 days ago.
2. Add new rules, incentives or deadlines from the last 60 days that matter to small firms of this trade in this country.
3. Replace news with up to 5 items from the last 60 days. Link the original publisher; write our own one-line takeaway, never copy their text.
4. Keep pains, solutions, hook and kpi unless the evidence changed. Every hook option tag must still match deadline tags.
5. Every text needs "it", "en" and "fa"; write it for a busy business owner, short and concrete, no hype.
Sources: {name, url, date (YYYY-MM-DD, the day you read it), kind: "official" | "press" | "association"}.
${learned(lessons)}Reply with the complete updated file as one JSON object in a \`\`\`json block, same fields as the input, and nothing after it.

\`\`\`json
${JSON.stringify(prev, null, 1)}
\`\`\``;

export type ResearchResult = { research: HubResearch; usage: { input: number; output: number; searches: number } };

export async function researchHub(prev: HubResearch, now = new Date(), lessons: string[] = []): Promise<ResearchResult> {
  const today = now.toISOString().slice(0, 10);
  const model = llm();
  const r = await model.complete({
    maxTokens: 64000,
    thinking: true,
    effort: "high",
    webSearch: { maxUses: 25 },
    messages: [{ role: "user", content: instructions(prev, today, lessons) }],
  });
  if (r.stop === "refusal") throw new Error("research refused by the model");
  if (r.stop === "max_tokens") throw new Error("research answer was cut off (max_tokens)");
  const research = researchSchema.parse({ ...(extractJson(r.text) as object), researchedAt: today, researcher: `hub-builder research step (${r.model})` });
  if (research.industry !== prev.industry || research.country !== prev.country) throw new Error("research answered for another hub");
  return { research, usage: r.usage };
}
