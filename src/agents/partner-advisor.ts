import Anthropic from "@anthropic-ai/sdk";
import { meter } from "./meter";
import { z } from "zod";
import { PARTNER_INTENTS, type PartnerIntent } from "@/server/partner-chat";

/*
 * The partner assistant with Claude (only with ANTHROPIC_API_KEY; otherwise the word rules in partner-chat.ts).
 * It answers any question about the partner's work from the facts it is given (today's priorities, projects
 * with brief and checklist, offers, pay, level, documents, messages from us) and picks which card to show;
 * accepting, delivering or messaging the team stay buttons the partner presses.
 */
export const partnerAdvisorEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

const LANG: Record<string, string> = { it: "Italian", en: "English", fa: "Persian", de: "German" };

// built on first use: partner-chat.ts imports this file, so its intents are not ready while modules load
const turnSchema = () =>
  z.object({
    reply: z.string().min(1).max(2000),
    intent: z.enum(PARTNER_INTENTS),
    // for "job": words of the project title; for "help": the partner's request in their words
    request: z.string().max(2000).nullable().optional(),
  });

export async function partnerAdvisorTurn(input: { lang: string; context: Record<string, unknown>; transcript: { role: "user" | "assistant"; text: string }[] }): Promise<{ reply: string; intent: PartnerIntent; request: string | null }> {
  const client = new Anthropic({ timeout: 30_000, maxRetries: 1 });
  const system = `You are the assistant in our partner portal, talking with a freelancer, company or agent who does work for us, in ${LANG[input.lang] ?? "English"}. Be clear and brief (1–4 sentences); the partner should never need to look through the portal's pages.
Facts you may use (this partner's own data): ${JSON.stringify(input.context)}. Answer from these facts only: never invent jobs, amounts, dates, rules or promises. If the answer is not there, offer to pass the question to the team.
Never reveal who the end customer is beyond the customer code. Disclose you are an AI if asked.
Pick the card to show with "intent", one of ${PARTNER_INTENTS.join(", ")}: "today" for priorities and deadlines, "job" for one project's brief/checklist/review (put words of its title in "request"), "help" when they want the team or a human review (put their request in their own words in "request" so they can confirm sending it), "fallback" when no card fits.
Reply with one JSON object only: {"reply": string, "intent": string, "request": string|null}`;
  const message = await client.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    output_config: { effort: "low" },
    system,
    messages: [{ role: "user", content: input.transcript.slice(-20).map((m) => `${m.role}: ${m.text}`).join("\n") }],
  });
  meter(message.usage);
  if (message.stop_reason === "refusal") throw new Error("refused");
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const t = turnSchema().parse(JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)));
  return { reply: t.reply, intent: t.intent, request: t.request ?? null };
}
