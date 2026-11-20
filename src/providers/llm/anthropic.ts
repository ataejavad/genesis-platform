import type { Env } from "../registry";
import Anthropic from "@anthropic-ai/sdk";
import { meter } from "@/agents/meter";
import type { Llm, LlmRequest, LlmResult } from "./types";

/*
 * Claude adapter: the only file in the app that imports the Anthropic SDK. LLM_MODEL overrides the model.
 * Long answers stream; a web-search turn the server pauses is resumed up to 6 times.
 */
export function anthropicLlm(env: Env = process.env): Llm {
  const model = env.LLM_MODEL && env.LLM_PROVIDER === "anthropic" ? env.LLM_MODEL : "claude-opus-5-5";
  return {
    provider: "anthropic",
    model,
    webSearch: true,
    async complete(req: LlmRequest): Promise<LlmResult> {
      const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: req.timeoutMs ?? 600_000, maxRetries: 1 });
      const messages: Anthropic.MessageParam[] = req.messages.map((m) => ({ role: m.role, content: m.content }));
      const usage = { input: 0, output: 0, searches: 0 };
      const long = req.maxTokens > 8000 || Boolean(req.webSearch);
      for (let turn = 0; turn < 6; turn++) {
        const params = {
          model,
          max_tokens: req.maxTokens,
          ...(req.system ? { system: req.system } : {}),
          ...(req.thinking ? { thinking: { type: "adaptive" as const } } : {}),
          ...(req.effort ? { output_config: { effort: req.effort } } : {}),
          ...(req.webSearch ? { tools: [{ type: "web_search_20260209" as const, name: "web_search" as const, max_uses: req.webSearch.maxUses }] } : {}),
          messages,
        };
        const message = long ? await client.messages.stream(params).finalMessage() : await client.messages.create(params);
        meter(message.usage);
        usage.input += message.usage.input_tokens;
        usage.output += message.usage.output_tokens;
        usage.searches += message.usage.server_tool_use?.web_search_requests ?? 0;
        if (message.stop_reason === "pause_turn") {
          messages.push({ role: "assistant", content: message.content });
          continue;
        }
        const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
        const stop = message.stop_reason === "refusal" ? "refusal" : message.stop_reason === "max_tokens" ? "max_tokens" : "end";
        return { text, stop, usage, model };
      }
      throw new Error("model did not finish after 6 turns");
    },
  };
}
