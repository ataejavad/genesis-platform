import type { Env } from "../registry";
import { meter } from "@/agents/meter";
import type { Llm, LlmRequest, LlmResult } from "./types";

/*
 * Any OpenAI-compatible chat API (OpenAI, Mistral, OpenRouter, Groq, a local Ollama/vLLM …):
 * LLM_PROVIDER=openai-compatible, LLM_BASE_URL (e.g. https://api.mistral.ai/v1), LLM_API_KEY, LLM_MODEL.
 * No SDK: plain fetch. No server-side web search, so research agents stay off with this provider.
 */
export function openAiCompatibleLlm(env: Env = process.env, fetchImpl: typeof fetch = fetch): Llm {
  const base = (env.LLM_BASE_URL ?? "").replace(/\/+$/, "");
  const model = env.LLM_MODEL ?? "";
  return {
    provider: "openai-compatible",
    model,
    webSearch: false,
    async complete(req: LlmRequest): Promise<LlmResult> {
      const res = await fetchImpl(`${base}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${env.LLM_API_KEY}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          max_tokens: req.maxTokens,
          messages: [...(req.system ? [{ role: "system", content: req.system }] : []), ...req.messages],
        }),
        signal: AbortSignal.timeout(req.timeoutMs ?? 600_000),
      });
      const body = (await res.json().catch(() => ({}))) as {
        choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
        error?: { message?: string };
      };
      if (!res.ok) throw new Error(`llm ${res.status}: ${body.error?.message ?? "error"}`);
      const c = body.choices?.[0];
      const usage = { input: body.usage?.prompt_tokens ?? 0, output: body.usage?.completion_tokens ?? 0, searches: 0 };
      meter({ input_tokens: usage.input, output_tokens: usage.output });
      const stop = c?.message?.refusal || c?.finish_reason === "content_filter" ? "refusal" : c?.finish_reason === "length" ? "max_tokens" : "end";
      return { text: c?.message?.content ?? "", stop, usage, model };
    },
  };
}
