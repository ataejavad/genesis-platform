import { meter } from "@/agents/meter";
import type { Env } from "../registry";
import type { Llm, LlmRequest, LlmResult } from "./types";

/*
 * Google Gemini (native generateContent, plain fetch, no SDK): GEMINI_API_KEY, optional LLM_MODEL
 * (default gemini-flash-latest). Web search = Google Search grounding.
 * Free tier (Javad's test phase, 2026-11-20): Google may use prompts and answers to improve its products, so no
 * real customer personal data goes through it until a paid tier or another provider is switched on.
 */
const BASE = "https://generativelanguage.googleapis.com/v1beta";
const THINKING: Record<string, number> = { low: 0, medium: 2048, high: 8192 };

export function geminiLlm(env: Env = process.env, fetchImpl: typeof fetch = fetch): Llm {
  const model = env.LLM_MODEL && env.LLM_PROVIDER === "gemini" ? env.LLM_MODEL : "gemini-flash-latest";
  return {
    provider: "gemini",
    model,
    webSearch: true,
    async complete(req: LlmRequest): Promise<LlmResult> {
      const budget = req.thinking ? (THINKING[req.effort ?? "medium"] ?? 2048) : req.effort === "low" ? 0 : undefined;
      const res = await fetchImpl(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": env.GEMINI_API_KEY ?? "", "content-type": "application/json" },
        body: JSON.stringify({
          ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
          contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          generationConfig: { maxOutputTokens: req.maxTokens, ...(budget !== undefined ? { thinkingConfig: { thinkingBudget: budget } } : {}) },
          ...(req.webSearch ? { tools: [{ google_search: {} }] } : {}),
        }),
        signal: AbortSignal.timeout(req.timeoutMs ?? 600_000),
      });
      const body = (await res.json().catch(() => ({}))) as {
        candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string; groundingMetadata?: { webSearchQueries?: string[] } }[];
        promptFeedback?: { blockReason?: string };
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
        error?: { message?: string };
      };
      if (!res.ok) throw new Error(`gemini ${res.status}: ${body.error?.message ?? "error"}`);
      const c = body.candidates?.[0];
      const u = body.usageMetadata ?? {};
      const usage = { input: u.promptTokenCount ?? 0, output: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0), searches: c?.groundingMetadata?.webSearchQueries?.length ?? 0 };
      meter({ input_tokens: usage.input, output_tokens: usage.output, server_tool_use: { web_search_requests: usage.searches } });
      const text = (c?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
      const blocked = Boolean(body.promptFeedback?.blockReason) || ["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "RECITATION", "SPII"].includes(c?.finishReason ?? "");
      return { text, stop: blocked ? "refusal" : c?.finishReason === "MAX_TOKENS" ? "max_tokens" : "end", usage, model };
    },
  };
}
