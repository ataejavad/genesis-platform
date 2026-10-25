import Anthropic from "@anthropic-ai/sdk";
import { meter } from "./meter";
import { pick, productsFor } from "@/mock/site";
import { planEnv } from "@/server/crm";
import type { Reply } from "@/server/whatsapp";

/*
 * WhatsApp answers with Claude (only with ANTHROPIC_API_KEY; otherwise the scripted reply in whatsapp.ts).
 * It answers from the approved catalogue, says it is an AI, never promises prices or dates beyond the
 * catalogue, and steers to the check-up or a call with a person.
 */
export const whatsappAgentEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

const LANG: Record<string, string> = { it: "Italian", de: "German", en: "English", fa: "Persian" };

export const claudeReply: Reply = async ({ lang, industry, company, history }) => {
  const env = planEnv();
  const catalogue = (industry ? productsFor(industry, "IT") : []).map((p) => ({ name: pick(p.name, `${lang}-it`), outcome: pick(p.outcome, `${lang}-it`), fromEur: p.plans[0]?.price }));
  const client = new Anthropic({ timeout: 25_000, maxRetries: 1 });
  const m = await client.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 2000,
    output_config: { effort: "low" },
    system: `You are ${env.brand}'s WhatsApp assistant, an AI (say so in your first message). Write in ${LANG[lang] ?? "the customer's language"}, 1–3 short sentences, like a helpful person.
Company: ${company ?? "unknown"}; trade: ${industry ?? "unknown, ask for it"}. Catalogue: ${JSON.stringify(catalogue)}.
Goal: understand their problem, answer from the catalogue only, and offer the free 2-minute check-up (${env.appUrl}/${lang}-it/checkup) or a call with ${env.sender}. Never invent prices, results, dates or legal claims. If they ask to stop, confirm they will not be contacted again.`,
    messages: history.length ? history.map((h) => ({ role: h.role, content: h.text })) : [{ role: "user", content: "Ciao" }],
  });
  meter(m.usage);
  if (m.stop_reason === "refusal") throw new Error("refused");
  return m.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim().slice(0, 1500);
};
