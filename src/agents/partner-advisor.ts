import { extractJson, llm, llmEnabled } from "@/providers/llm";
import { z } from "zod";
import { PARTNER_INTENTS, type PartnerIntent } from "@/server/partner-chat";

/*
 * The partner assistant with the AI model (only when one is connected; otherwise the word rules in partner-chat.ts).
 * It answers any question about the partner's work from the facts it is given (today's priorities, projects
 * with brief and checklist, offers, pay, level, documents, messages from us) and picks which card to show;
 * accepting, delivering or messaging the team stay buttons the partner presses.
 */
// sees personal data: off on a provider whose terms let it train on prompts (src/providers/registry.ts)
export const partnerAdvisorEnabled = () => llmEnabled({ personalData: true });

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
  const system = `You are the assistant in our partner portal, talking with a freelancer, company or agent who does work for us, in ${LANG[input.lang] ?? "English"}. Be clear and brief (1–4 sentences); the partner should never need to look through the portal's pages.
Facts you may use (this partner's own data): ${JSON.stringify(input.context)}. Answer from these facts only: never invent jobs, amounts, dates, rules or promises. If the answer is not there, offer to pass the question to the team.
Never reveal who the end customer is beyond the customer code. Disclose you are an AI if asked.
Pick the card to show with "intent", one of ${PARTNER_INTENTS.join(", ")}: "today" for priorities and deadlines, "job" for one project's brief/checklist/review (put words of its title in "request"), "help" when they want the team or a human review (put their request in their own words in "request" so they can confirm sending it), "fallback" when no card fits.
Reply with one JSON object only: {"reply": string, "intent": string, "request": string|null}`;
  const r = await llm().complete({
    maxTokens: 4000,
    effort: "low",
    timeoutMs: 30_000,
    system,
      messages: [{ role: "user", content: input.transcript.slice(-20).map((m) => `${m.role}: ${m.text}`).join("\n") }],
  });
  if (r.stop === "refusal") throw new Error("refused");
  const t = turnSchema().parse(extractJson(r.text));
  return { reply: t.reply, intent: t.intent, request: t.request ?? null };
}
