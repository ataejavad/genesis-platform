import type { Env } from "../registry";
import type { CallReport, VoiceCaller } from ".";

/*
 * Vapi: VAPI_API_KEY, VAPI_ASSISTANT_ID, VAPI_PHONE_NUMBER_ID. The assistant's voice, model and webhook are
 * configured once in Vapi; we pass the first sentence and the call script per call.
 */
export function vapiCaller(env: Env = process.env, fetchImpl: typeof fetch = fetch): VoiceCaller {
  const { VAPI_API_KEY: key, VAPI_ASSISTANT_ID: assistantId, VAPI_PHONE_NUMBER_ID: phoneNumberId } = env;
  return {
    provider: "vapi",
    async call(c) {
      const res = await fetchImpl("https://api.vapi.ai/call", {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          assistantId,
          phoneNumberId,
          customer: { number: c.to.replace(/[^\d+]/g, "") },
          assistantOverrides: { firstMessage: c.firstMessage, variableValues: { script: c.script, language: c.language }, metadata: c.metadata },
          metadata: c.metadata,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string | string[] };
      if (!res.ok || !body.id) throw new Error(`vapi ${res.status}: ${[body.message].flat().join("; ") || "error"}`);
      return body.id;
    },
  };
}

// Vapi's end-of-call report → one of our phone outcomes. The assistant is asked to return `outcome` as structured data.
const KNOWN = ["no_answer", "callback", "interested", "meeting", "not_interested", "wrong_number", "talked"];
export function outcomeOfReport(report: { endedReason?: string; analysis?: { structuredData?: { outcome?: string } } }) {
  const o = report.analysis?.structuredData?.outcome;
  if (o && KNOWN.includes(o)) return o;
  if (/no-answer|did-not-answer|voicemail|busy|failed/i.test(report.endedReason ?? "")) return "no_answer";
  return "talked";
}

/** Vapi posts an end-of-call report to the assistant's server URL with header x-vapi-secret = VAPI_WEBHOOK_SECRET. */
export function vapiReport(headers: Headers, body: unknown, env: Env = process.env): CallReport {
  const secret = env.VAPI_WEBHOOK_SECRET;
  if (!secret || headers.get("x-vapi-secret") !== secret) return { status: "unauthorized" };
  const { message } = (body ?? {}) as { message?: { type?: string; endedReason?: string; analysis?: { structuredData?: { outcome?: string } }; call?: { metadata?: { touchId?: string } } } };
  const touchId = message?.call?.metadata?.touchId;
  if (message?.type !== "end-of-call-report" || !touchId) return { status: "ignored" };
  return { status: "ended", touchId, outcome: outcomeOfReport(message) };
}
