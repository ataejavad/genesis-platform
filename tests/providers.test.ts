import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { mailerFromEnv } from "@/providers/email";
import { ask, llm, llmEnabled, setLlmForTests } from "@/providers/llm";
import { mockLlm } from "@/providers/llm/mock";
import { geminiLlm } from "@/providers/llm/gemini";
import { openAiCompatibleLlm } from "@/providers/llm/openai-compatible";
import { chosen, KINDS, providerBoard, providerStatus } from "@/providers/registry";
import { voiceFromEnv } from "@/providers/voice";
import { adminChatFromEnv } from "@/providers/admin-chat";
import { MODULES } from "@/config/modules";

/*
 * Javad 2026-11-20: every outside company must be swappable without touching business logic. Business code may
 * use only our own interfaces in src/providers/<kind>/index.ts; vendor SDKs, vendor API hosts and adapter files
 * stay inside src/providers.
 */
const VENDOR_PACKAGES = ["@anthropic-ai/sdk", "openai", "stripe", "twilio", "@sendgrid/", "@aws-sdk/", "nodemailer", "@mistralai/", "@google/generative-ai", "@slack/"];
const VENDOR_HOSTS = ["api.anthropic.com", "api.brevo.com", "api.vapi.ai", "api.telegram.org", "graph.facebook.com", "api.apify.com", "api.apollo.io", "api.openai.com", "api.stripe.com", "api.twilio.com", "api.mistral.ai"];

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? (f === "node_modules" ? [] : files(p)) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

const business = [...files("src"), ...files("app"), ...files("scripts")].filter((f) => !f.startsWith(path.join("src", "providers")));

describe("provider boundary", () => {
  it("no vendor SDK is imported outside src/providers", () => {
    const bad = business.flatMap((f) => {
      const s = readFileSync(f, "utf8");
      return VENDOR_PACKAGES.filter((p) => new RegExp(`from ["']${p.replace(/[/.]/g, "\\$&")}`).test(s)).map((p) => `${f}: ${p}`);
    });
    expect(bad).toEqual([]);
  });

  it("no vendor API host is called outside src/providers", () => {
    const bad = business.flatMap((f) => VENDOR_HOSTS.filter((h) => readFileSync(f, "utf8").includes(h)).map((h) => `${f}: ${h}`));
    expect(bad).toEqual([]);
  });

  it("business code uses a provider's interface, never one adapter file", () => {
    const bad = business.flatMap((f) => [...readFileSync(f, "utf8").matchAll(/from ["'](?:@\/|(?:\.\.\/)+src\/)providers\/([\w-]+)\/([\w-]+)["']/g)].filter((m) => m[2] !== "index").map((m) => `${f}: providers/${m[1]}/${m[2]}`));
    expect(bad).toEqual([]);
  });

  it("every adapter that exists is named in the registry", () => {
    const dirs = readdirSync("src/providers").filter((d) => statSync(path.join("src/providers", d)).isDirectory());
    expect(dirs.map((d) => d.replace(/-/g, "_")).filter((d) => !KINDS.some((k) => k.kind === d))).toEqual([]);
  });

  it("every module's provider kind exists", () => {
    expect(MODULES.flatMap((m) => m.uses ?? []).filter((u) => !KINDS.some((k) => k.kind === u))).toEqual([]);
  });
});

describe("provider choice", () => {
  afterEach(() => setLlmForTests(null));

  it("picks the vendor whose keys are set, the env override, or the fallback", () => {
    expect(chosen("llm", {})).toBe("mock");
    expect(chosen("llm", { ANTHROPIC_API_KEY: "k" })).toBe("anthropic");
    expect(chosen("llm", { ANTHROPIC_API_KEY: "k", LLM_PROVIDER: "openai-compatible" })).toBe("openai-compatible");
    expect(chosen("llm", { LLM_PROVIDER: "nonsense" })).toBe("mock");
    expect(chosen("email", {})).toBe("outbox");
    expect(chosen("email", { BREVO_API_KEY: "k", MAIL_FROM: "a@b.c" })).toBe("brevo");
    expect(providerStatus("email", { EMAIL_PROVIDER: "brevo" })).toMatchObject({ id: "brevo", connected: false, missing: ["BREVO_API_KEY", "MAIL_FROM"] });
  });

  it("each kind runs without its vendor", () => {
    expect(mailerFromEnv({})).toBeNull();
    expect(mailerFromEnv({ EMAIL_PROVIDER: "mock" })?.provider).toBe("mock");
    expect(voiceFromEnv({})).toBeNull();
    expect(adminChatFromEnv({})).toBeNull();
    expect(llmEnabled({}, {})).toBe(false);
    expect(llm({}).provider).toBe("mock");
    // only the free official VAT check works with no key at all
    expect(providerBoard({}).filter((k) => k.active.connected).map((k) => k.kind)).toEqual(["vat_check"]);
  });

  it("a model without web search keeps research agents off", () => {
    const env = { LLM_PROVIDER: "openai-compatible", LLM_BASE_URL: "https://llm.test/v1", LLM_API_KEY: "k", LLM_MODEL: "m" };
    expect(llmEnabled({}, env)).toBe(true);
    expect(llmEnabled({ webSearch: true }, env)).toBe(false);
  });

  it("Gemini free tier: research runs, agents that see personal data stay off until the paid tier", async () => {
    const env = { LLM_PROVIDER: "gemini", GEMINI_API_KEY: "k" };
    expect(chosen("llm", { GEMINI_API_KEY: "k" })).toBe("gemini");
    expect(llmEnabled({ webSearch: true }, env)).toBe(true);
    expect(llmEnabled({ personalData: true }, env)).toBe(false);
    expect(llmEnabled({ personalData: true }, { ...env, GEMINI_PAID_TIER: "1" })).toBe(true);
    expect(llmEnabled({ personalData: true }, { ANTHROPIC_API_KEY: "k" })).toBe(true);

    const seen: { url: string; headers: Record<string, string>; body: any }[] = [];
    const f = (async (url: string, init: { body: string; headers: Record<string, string> }) => (
      seen.push({ url, headers: init.headers, body: JSON.parse(init.body) }),
      Response.json({ candidates: [{ content: { parts: [{ text: "pensiero", thought: true }, { text: "ciao" }] }, finishReason: "STOP", groundingMetadata: { webSearchQueries: ["a", "b"] } }], usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2, thoughtsTokenCount: 3 } })
    )) as unknown as typeof fetch;
    const r = await geminiLlm(env, f).complete({ system: "be brief", maxTokens: 50, webSearch: { maxUses: 3 }, messages: [{ role: "user", content: "hi" }, { role: "assistant", content: "yes?" }, { role: "user", content: "go" }] });
    expect(r).toMatchObject({ text: "ciao", stop: "end", usage: { input: 4, output: 5, searches: 2 }, model: "gemini-flash-latest" });
    expect(seen[0].url).toContain("/models/gemini-flash-latest:generateContent");
    expect(seen[0].headers["x-goog-api-key"]).toBe("k");
    expect(seen[0].body).toMatchObject({ systemInstruction: { parts: [{ text: "be brief" }] }, contents: [{ role: "user" }, { role: "model" }, { role: "user" }], tools: [{ google_search: {} }] });
  });

  it("agents talk to any model through the same request", async () => {
    const m = mockLlm(() => '{"ok": true}');
    setLlmForTests(m);
    expect(await ask({ maxTokens: 10, messages: [{ role: "user", content: "hi" }] })).toBe('{"ok": true}');
    expect(m.calls[0].messages[0].content).toBe("hi");

    const seen: unknown[] = [];
    const f = (async (_url: string, init: { body: string }) => (seen.push(JSON.parse(init.body)), Response.json({ choices: [{ message: { content: "ciao" }, finish_reason: "stop" }], usage: { prompt_tokens: 3, completion_tokens: 1 } }))) as unknown as typeof fetch;
    const r = await openAiCompatibleLlm({ LLM_BASE_URL: "https://llm.test/v1/", LLM_API_KEY: "k", LLM_MODEL: "m" }, f).complete({ system: "be brief", maxTokens: 5, messages: [{ role: "user", content: "hi" }] });
    expect(r).toMatchObject({ text: "ciao", stop: "end", usage: { input: 3, output: 1 } });
    expect(seen[0]).toMatchObject({ model: "m", messages: [{ role: "system", content: "be brief" }, { role: "user", content: "hi" }] });
  });
});

describe("Gemini free-tier quota", () => {
  it("asks again without a thinking budget when a model refuses it", async () => {
    const bodies: { generationConfig: { thinkingConfig?: unknown } }[] = [];
    const f = (async (_url: string, init: RequestInit) => {
      const b = JSON.parse(String(init.body));
      bodies.push(b);
      return b.generationConfig.thinkingConfig ? Response.json({ error: { code: 400, message: "Request contains an invalid argument." } }, { status: 400 }) : Response.json({ candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }] });
    }) as unknown as typeof fetch;
    const r = await geminiLlm({ GEMINI_API_KEY: "k" }, f).complete({ maxTokens: 10, thinking: true, effort: "low", messages: [{ role: "user", content: "hi" }] });
    expect(r.text).toBe("ok");
    expect(bodies).toHaveLength(2);
  });

  it("a web-search call moves to a model with free quota left, and names the quota it hit", async () => {
    const quota = { error: { code: 429, message: "You exceeded your current quota, please check your plan and billing details.", details: [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier", quotaValue: "0" }] }] } };
    const urls: string[] = [];
    const f = (async (url: string) => {
      urls.push(url);
      return url.includes("gemini-flash-latest") ? Response.json(quota, { status: 429 }) : Response.json({ candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }] });
    }) as unknown as typeof fetch;
    const r = await geminiLlm({ GEMINI_API_KEY: "k" }, f).complete({ maxTokens: 10, webSearch: { maxUses: 1 }, messages: [{ role: "user", content: "hi" }] });
    expect(r.model).toBe("gemini-2.5-flash");
    // no 2 s / 6 s retries on a quota that does not clear in seconds
    expect(urls.filter((u) => u.includes("gemini-flash-latest"))).toHaveLength(1);

    const all429 = (async () => Response.json(quota, { status: 429 })) as unknown as typeof fetch;
    await expect(geminiLlm({ GEMINI_API_KEY: "k" }, all429).complete({ maxTokens: 10, webSearch: { maxUses: 1 }, messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(/FreeTier limit 0/);
    // plain calls try the lite model once, then name both
    await expect(geminiLlm({ GEMINI_API_KEY: "k" }, all429).complete({ maxTokens: 10, messages: [{ role: "user", content: "hi" }] })).rejects.toThrow(/gemini 429 \(gemini-flash-lite-latest\).*tried gemini-flash-latest: 429/);
  });
});
