import type { Llm, LlmRequest, LlmResult } from "./types";

/**
 * Mock model for tests and demos: answers with `answer(req)` (default: an empty JSON object).
 * llmEnabled() treats it as "no model", so the rule-based fallbacks run unless a test sets it on purpose.
 */
export function mockLlm(answer: (req: LlmRequest) => string = () => "{}", opts: { webSearch?: boolean } = {}): Llm & { calls: LlmRequest[] } {
  const calls: LlmRequest[] = [];
  return {
    provider: "mock",
    model: "mock",
    webSearch: opts.webSearch ?? true,
    calls,
    async complete(req): Promise<LlmResult> {
      calls.push(req);
      return { text: answer(req), stop: "end", usage: { input: 0, output: 0, searches: 0 }, model: "mock" };
    },
  };
}
