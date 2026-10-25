import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { INTENTS, type Intent } from "@/server/portal-chat";

/*
 * The dashboard advisor with Claude (only with ANTHROPIC_API_KEY; otherwise the word rules in portal-chat.ts).
 * Claude writes the sentence and chooses which approved card to show; the card data always comes from the
 * database, and anything that changes something stays a confirm card the customer presses. It never quotes a
 * number that is not in the context it was given.
 */
export const advisorEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

const LANG: Record<string, string> = { it: "Italian", en: "English", fa: "Persian", de: "German" };

const turnSchema = z.object({
  reply: z.string().min(1).max(1500),
  intent: z.enum(INTENTS),
  // the customer's problem or request in their words, when intent is problem or support and it is clear
  request: z.string().max(2000).nullable().optional(),
});
export type AdvisorTurn = { reply: string; intent: Intent; request: string | null };

export async function advisorTurn(input: { lang: string; company: string; context: Record<string, unknown>; transcript: { role: "user" | "assistant"; text: string }[] }): Promise<AdvisorTurn> {
  const client = new Anthropic({ timeout: 30_000, maxRetries: 1 });
  const system = `You are the advisor in the customer dashboard of ${input.company}, in ${LANG[input.lang] ?? "English"}. Be warm and brief (1–3 sentences).
We sell results, not tools: talk about calls answered, quotes sent, jobs won, hours and € back, never about software, AI models, tokens or usage.
Facts you may use (the customer's own data): ${JSON.stringify(input.context)}. Never invent numbers, prices, dates or promises outside these facts; for anything else, offer to pass it to the team.
Pick the card to show with "intent": one of ${INTENTS.join(", ")}. Use "problem" when they describe something that costs them time or money, "support" when something we deliver does not work; then put their request in their own words in "request" so they can confirm sending it to the team. Disclose you are an AI if asked.
Reply with one JSON object only: {"reply": string, "intent": string, "request": string|null}`;
  const message = await client.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    output_config: { effort: "low" },
    system,
    messages: [{ role: "user", content: input.transcript.slice(-20).map((m) => `${m.role}: ${m.text}`).join("\n") }],
  });
  if (message.stop_reason === "refusal") throw new Error("refused");
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const t = turnSchema.parse(JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)));
  return { reply: t.reply, intent: t.intent, request: t.request ?? null };
}
