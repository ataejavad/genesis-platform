import Anthropic from "@anthropic-ai/sdk";
import { meter } from "./meter";
import { z } from "zod";
import type { Criterion } from "@/db/schema";

/*
 * QA judge (doc 15 §6د2 agent 7; research/step7-delivery-qa-2026.md). Only with ANTHROPIC_API_KEY.
 * Each criterion gets pass, fail or unsure on its own; it never guesses: "unsure" sends the delivery to a
 * person. Criteria a person must check (method "human") are left to people. Javad's later decisions on the
 * same deliveries are the gold set we measure the judge against (Cockpit › QA shows the agreement).
 */
export const qaJudgeEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

const schema = z.object({
  results: z.array(z.object({ idx: z.number().int().min(0), result: z.enum(["pass", "fail", "unsure"]), note: z.string().max(400).optional() })),
});

export type JudgeInput = { goal: string; rules: string[]; criteria: Criterion[]; selfCheck: boolean[]; link: string; note: string | null; lessons?: string[] };

export async function judge(input: JudgeInput) {
  const client = new Anthropic({ timeout: 60_000, maxRetries: 1 });
  const list = input.criteria.map((c, i) => `${i}. [${c.mandatory ? "mandatory" : "optional"}, ${c.method}] ${c.text} (partner ticked: ${input.selfCheck[i] ? "yes" : "no"})`).join("\n");
  const system = `You check a delivered piece of work against its acceptance criteria. Judge each criterion separately with "pass", "fail" or "unsure", from the evidence given only.
Say "unsure" whenever the evidence does not show the criterion is met; never assume. Criteria marked "human" are always "unsure" (a person checks them).
A partner's own tick is a claim, not evidence. Fixed rules every delivery must respect: ${input.rules.join(" | ")}. A visible break of a fixed rule fails the closest criterion.${input.lessons?.length ? `\nWhat earlier projects taught us (look for these): ${input.lessons.join(" | ")}` : ""}
Reply with one JSON object only: {"results": [{"idx": number, "result": "pass"|"fail"|"unsure", "note": string}]}`;
  const message = await client.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    output_config: { effort: "medium" },
    system,
    messages: [{ role: "user", content: `Goal: ${input.goal}\nDelivery link: ${input.link}\nPartner's note: ${input.note ?? "(none)"}\nCriteria:\n${list}` }],
  });
  meter(message.usage);
  if (message.stop_reason === "refusal") throw new Error("refused");
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const parsed = schema.parse(JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)));
  // one result per criterion; anything missing or "human" stays unsure
  return input.criteria.map((c, idx) => {
    const r = parsed.results.find((x) => x.idx === idx);
    return { idx, result: c.method === "human" || !r ? ("unsure" as const) : r.result, note: r?.note };
  });
}

/** accept when every mandatory criterion passed; changes when one failed; otherwise a person looks. */
export function verdictOf(criteria: Criterion[], results: { idx: number; result: "pass" | "fail" | "unsure" }[]): "accept" | "changes" | "review" {
  const mandatory = results.filter((r) => criteria[r.idx]?.mandatory);
  if (mandatory.some((r) => r.result === "fail")) return "changes";
  if (mandatory.every((r) => r.result === "pass")) return "accept";
  return "review";
}
