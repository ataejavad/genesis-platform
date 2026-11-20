import type { Env } from "../registry";
import { chosen } from "../registry";
import { vapiCaller, vapiReport } from "./vapi";

/*
 * AI voice calls, provider-agnostic. VOICE_PROVIDER = vapi | none | mock (auto: vapi when its keys are set).
 * Without a caller every call stays a task for a person. Whether it may call at all is decided by
 * outreach-rules (Javad's switch per country + legal basis), never here.
 */
export type VoiceCall = { to: string; firstMessage: string; script: string; language: string; metadata: { touchId: string; prospectId: string } };
export type VoiceCaller = { provider: string; call: (c: VoiceCall) => Promise<string> };
/** The provider's end-of-call webhook in our shape: "unauthorized", "ignored", or which touch ended how. */
export type CallReport = { status: "unauthorized" } | { status: "ignored" } | { status: "ended"; touchId: string; outcome: string };

export function mockCaller(): VoiceCaller & { calls: VoiceCall[] } {
  const calls: VoiceCall[] = [];
  return { provider: "mock", calls, call: async (c) => (calls.push(c), `mock-call-${calls.length}`) };
}

export function voiceFromEnv(env: Env = process.env): VoiceCaller | null {
  switch (chosen("voice", env)) {
    case "vapi":
      return env.VAPI_API_KEY && env.VAPI_ASSISTANT_ID && env.VAPI_PHONE_NUMBER_ID ? vapiCaller(env) : null;
    case "mock":
      return mockCaller();
    default:
      return null;
  }
}

export { outcomeOfReport } from "./vapi";

/** Reads the active provider's end-of-call webhook (the route stays the same when the provider changes). */
export function readCallReport(headers: Headers, body: unknown, env: Env = process.env): CallReport {
  return vapiReport(headers, body, env);
}
