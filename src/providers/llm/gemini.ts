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
// Free tier (2026-11-21): Google Search grounding answered 429 "exceeded your current quota" on the default model all
// day, so web-search calls try these next when a model has no free quota left. GEMINI_SEARCH_MODELS overrides the list.
const SEARCH_FALLBACK = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-lite-latest"];
// plain calls: the free default model answers 503 "high demand" at busy hours; the lite model usually still answers
const PLAIN_FALLBACK = ["gemini-flash-lite-latest"];

type GeminiError = { message?: string; details?: { "@type"?: string; violations?: { quotaMetric?: string; quotaId?: string; quotaValue?: string }[] }[] };
/** The quota Google names in a 429 (metric, limit), so the cockpit says which limit was hit. */
export function quotaLine(e: GeminiError | undefined) {
  const v = e?.details?.flatMap((d) => d.violations ?? []) ?? [];
  return v.length ? ` [${v.map((x) => `${x.quotaId ?? x.quotaMetric ?? "quota"}${x.quotaValue !== undefined ? ` limit ${x.quotaValue}` : ""}`).join("; ")}]` : "";
}

export function geminiLlm(env: Env = process.env, fetchImpl: typeof fetch = fetch): Llm {
  const model = env.LLM_MODEL && env.LLM_PROVIDER === "gemini" ? env.LLM_MODEL : "gemini-flash-latest";
  return {
    provider: "gemini",
    model,
    webSearch: true,
    async complete(req: LlmRequest): Promise<LlmResult> {
      const budget = req.thinking ? (THINKING[req.effort ?? "medium"] ?? 2048) : req.effort === "low" ? 0 : undefined;
      const send = (m: string, think = true) => fetchImpl(`${BASE}/models/${encodeURIComponent(m)}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": env.GEMINI_API_KEY ?? "", "content-type": "application/json" },
        body: JSON.stringify({
          ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
          contents: req.messages.map((msg) => ({ role: msg.role === "assistant" ? "model" : "user", parts: [{ text: msg.content }] })),
          generationConfig: { maxOutputTokens: req.maxTokens, ...(budget !== undefined && think ? { thinkingConfig: { thinkingBudget: budget } } : {}) },
          ...(req.webSearch ? { tools: [{ google_search: {} }] } : {}),
        }),
        signal: AbortSignal.timeout(req.timeoutMs ?? 600_000),
      });
      // the free tier answers 503 (busy) or 429 (rate limit) often: try again twice, 2 s then 6 s later
      const attempt = async (m: string) => {
        let think = true;
        let r = await send(m);
        // some models refuse a thinking budget (400 invalid argument): ask without it from here on
        if (r.status === 400 && budget !== undefined) {
          think = false;
          r = await send(m, think);
        }
        for (const wait of [2000, 6000]) {
          if (r.status !== 503 && r.status !== 429) break;
          // "exceeded your current quota" does not clear in seconds: no point waiting
          if (r.status === 429 && /current quota/i.test(await r.clone().text().catch(() => ""))) break;
          await new Promise((ok) => setTimeout(ok, wait));
          r = await send(m, think);
        }
        return r;
      };
      const models = [model, ...(req.webSearch ? (env.GEMINI_SEARCH_MODELS?.split(",").map((x) => x.trim()).filter(Boolean) ?? SEARCH_FALLBACK) : PLAIN_FALLBACK)].filter((m, i, a) => a.indexOf(m) === i);
      let used = model;
      let res = await attempt(model);
      const tried: string[] = [];
      for (const next of models.slice(1)) {
        if (res.status !== 429 && res.status !== 404 && res.status !== 503) break;
        tried.push(`${used}: ${res.status}${quotaLine(((await res.clone().json().catch(() => ({}))) as { error?: GeminiError }).error)}`);
        used = next;
        res = await attempt(next);
      }
      const body = (await res.json().catch(() => ({}))) as {
        candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string; groundingMetadata?: { webSearchQueries?: string[] } }[];
        promptFeedback?: { blockReason?: string };
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
        error?: GeminiError;
      };
      if (!res.ok) throw new Error(`gemini ${res.status} (${used}): ${(body.error?.message ?? "error").slice(0, 120)}${quotaLine(body.error)}${tried.length ? ` · tried ${tried.join(" · ")}` : ""}`);
      const c = body.candidates?.[0];
      const u = body.usageMetadata ?? {};
      const usage = { input: u.promptTokenCount ?? 0, output: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0), searches: c?.groundingMetadata?.webSearchQueries?.length ?? 0 };
      meter({ input_tokens: usage.input, output_tokens: usage.output, server_tool_use: { web_search_requests: usage.searches } });
      const text = (c?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
      const blocked = Boolean(body.promptFeedback?.blockReason) || ["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "RECITATION", "SPII"].includes(c?.finishReason ?? "");
      return { text, stop: blocked ? "refusal" : c?.finishReason === "MAX_TOKENS" ? "max_tokens" : "end", usage, model: used };
    },
  };
}
