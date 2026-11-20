import { extractJson, llm, llmEnabled } from "@/providers/llm";
import { z } from "zod";
import type { LocalizedCheckup } from "@/server/checkup";

/*
 * Free conversation for the check-up, used only when an AI model is connected. The model talks like an advisor,
 * but it can only fill the same questions with the same option ids, so scoring stays rule-based and auditable.
 * Without a key the browser runs the scripted conversation (chips + typed-answer matching) on the same engine.
 */
// sees personal data: off on a provider whose terms let it train on prompts (src/providers/registry.ts)
export const chatEnabled = () => llmEnabled({ personalData: true });

const LANG: Record<string, string> = { it: "Italian", en: "English", fa: "Persian", de: "German" };

export const chatTurnSchema = z.object({
  reply: z.string().min(1).max(1200),
  industry: z.string().nullable(),
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
});
export type ChatTurn = z.infer<typeof chatTurnSchema>;

export async function chatTurn(input: {
  lang: string;
  defs: Record<string, LocalizedCheckup & { name: string }>;
  industry: string | null;
  answers: Record<string, string | string[]>;
  transcript: { role: "user" | "assistant"; text: string }[];
}): Promise<ChatTurn> {
  const trades = Object.entries(input.defs).map(([slug, d]) => ({ slug, name: d.name, questions: d.questions.map((q) => ({ id: q.id, multi: q.multi, ask: q.label, options: q.options.map((o) => ({ id: o.id, label: o.label })) })) }));
  const system = `You run a free 2-minute check-up for small firms, in ${LANG[input.lang] ?? "English"}, as a warm, brief business advisor (1–3 sentences per turn).
Goal: learn the visitor's trade and answer every check-up question of that trade, steering the talk from what they say. Ask one thing at a time; skip anything they already told you.
Only these trades exist: ${JSON.stringify(trades)}. If their trade is not listed, say we are specialists in the listed trades and suggest they tell us their trade.
Rules: never invent numbers, savings, prices, customers or legal claims; you only collect answers. Disclose you are an AI if asked.
Reply with one JSON object only: {"reply": string, "industry": trade slug or null, "answers": {questionId: optionId or [optionIds] for multi}}. Include only answers the visitor clearly gave, mapped to the closest option.`;
  const r = await llm().complete({
    maxTokens: 4000,
    effort: "low",
    timeoutMs: 30_000,
    system,
      messages: [
        { role: "user", content: `State so far: ${JSON.stringify({ industry: input.industry, answers: input.answers })}\n\nConversation:\n${input.transcript.map((m) => `${m.role}: ${m.text}`).join("\n")}` },
      ],
  });
  if (r.stop === "refusal") throw new Error("refused");
  const turn = chatTurnSchema.parse(extractJson(r.text));
  // Keep only valid trades and option ids; anything else is dropped, never trusted.
  const def = turn.industry ? input.defs[turn.industry] : undefined;
  const answers: ChatTurn["answers"] = {};
  for (const q of def?.questions ?? []) {
    const a = turn.answers[q.id];
    const ids = new Set(q.options.map((o) => o.id));
    if (q.multi && Array.isArray(a) && a.every((x) => ids.has(x))) answers[q.id] = a;
    if (!q.multi && typeof a === "string" && ids.has(a)) answers[q.id] = a;
  }
  return { reply: turn.reply, industry: def ? turn.industry : null, answers };
}
