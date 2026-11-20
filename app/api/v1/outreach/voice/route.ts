import { getDb } from "@/db";
import { errorResponse } from "@/server/http";
import { completeTouch } from "@/server/outreach";
import { readCallReport } from "@/server/voice";

/**
 * The AI caller (VOICE_PROVIDER; Vapi today) calls this at the end of each call. The provider adapter checks
 * its secret and reads its report; the outcome moves the company in the CRM like a call made by a person.
 */
export async function POST(req: Request) {
  try {
    const r = readCallReport(req.headers, await req.json());
    if (r.status === "unauthorized") return Response.json({ error: { code: "unauthorized" } }, { status: 401 });
    if (r.status === "ignored") return Response.json({ ok: true, ignored: true });
    await completeTouch(getDb(), { type: "system", id: "voice-ai" }, r.touchId, r.outcome);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
