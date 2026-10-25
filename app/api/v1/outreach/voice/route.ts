import { getDb } from "@/db";
import { errorResponse } from "@/server/http";
import { completeTouch } from "@/server/outreach";
import { outcomeOfReport } from "@/server/voice";

/**
 * Vapi calls this at the end of each AI call (set as the assistant's server URL with VAPI_WEBHOOK_SECRET).
 * The outcome moves the company in the CRM like a call made by a person.
 */
export async function POST(req: Request) {
  try {
    const secret = process.env.VAPI_WEBHOOK_SECRET;
    if (!secret || req.headers.get("x-vapi-secret") !== secret) return Response.json({ error: { code: "unauthorized" } }, { status: 401 });
    const { message } = (await req.json()) as { message?: { type?: string; endedReason?: string; analysis?: { structuredData?: { outcome?: string } }; call?: { metadata?: { touchId?: string } } } };
    const touchId = message?.call?.metadata?.touchId;
    if (message?.type !== "end-of-call-report" || !touchId) return Response.json({ ok: true, ignored: true });
    await completeTouch(getDb(), { type: "system", id: "voice-ai" }, touchId, outcomeOfReport(message));
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
