/*
 * AI voice calls, provider-agnostic. Vapi when VAPI_API_KEY, VAPI_ASSISTANT_ID and VAPI_PHONE_NUMBER_ID are
 * set (the assistant's voice, model and webhook are configured once in Vapi; we pass the first sentence and
 * the call script per call). Without them there is no AI caller and every call stays a task for a person.
 * Whether it may call at all is decided by outreach-rules (Javad's switch per country + legal basis).
 */

export type VoiceCall = { to: string; firstMessage: string; script: string; language: string; metadata: { touchId: string; prospectId: string } };
export type VoiceCaller = { provider: string; call: (c: VoiceCall) => Promise<string> };

export function voiceFromEnv(env = process.env): VoiceCaller | null {
  const { VAPI_API_KEY: key, VAPI_ASSISTANT_ID: assistantId, VAPI_PHONE_NUMBER_ID: phoneNumberId } = env;
  if (!key || !assistantId || !phoneNumberId) return null;
  return {
    provider: "vapi",
    async call(c) {
      const res = await fetch("https://api.vapi.ai/call", {
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
