import type { Env } from "../registry";
import { chosen, providerStatus } from "../registry";
import { anthropicLlm } from "./anthropic";
import { mockLlm } from "./mock";
import { openAiCompatibleLlm } from "./openai-compatible";
import type { Llm, LlmRequest } from "./types";

export type { Llm, LlmMessage, LlmRequest, LlmResult } from "./types";

/*
 * The AI model behind every agent. Agents call `llm().complete({...})` with our own request shape; which company
 * answers is LLM_PROVIDER (anthropic | openai-compatible | mock), picked automatically from the keys when unset.
 * Web search is a capability: agents that need it are off when the active provider has none.
 */

let override: Llm | null = null;
/** Tests: answer every agent call with this adapter (pass null to reset). */
export function setLlmForTests(l: Llm | null) {
  override = l;
}

export function llm(env: Env = process.env): Llm {
  if (override) return override;
  switch (chosen("llm", env)) {
    case "anthropic":
      return anthropicLlm(env);
    case "openai-compatible":
      return openAiCompatibleLlm(env);
    default:
      return mockLlm();
  }
}

/** True when a real model is connected (and, if asked, it can search the web). The mock never counts. */
export function llmEnabled(need: { webSearch?: boolean } = {}, env: Env = process.env) {
  if (override) return !need.webSearch || override.webSearch;
  const s = providerStatus("llm", env);
  if (!s.connected) return false;
  return !need.webSearch || llm(env).webSearch;
}

/** Text of the last JSON object (or array) in a reply, fenced ```json first. */
export function extractJson(text: string, open: "{" | "[" = "{"): unknown {
  const fenced = [...text.matchAll(/```json\s*([\s\S]*?)```/g)].at(-1)?.[1];
  const close = open === "{" ? "}" : "]";
  return JSON.parse(fenced ?? text.slice(text.indexOf(open), text.lastIndexOf(close) + 1));
}

/** One call that must end normally; refusals and cut-off answers become errors. Returns the text. */
export async function ask(req: LlmRequest, what = "answer"): Promise<string> {
  const r = await llm().complete(req);
  if (r.stop === "refusal") throw new Error(`${what} refused by the model`);
  if (r.stop === "max_tokens") throw new Error(`${what} was cut off (max_tokens)`);
  return r.text;
}
