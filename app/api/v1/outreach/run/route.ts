import { getDb } from "@/db";
import { authenticateAgent } from "@/server/api-keys";
import { planEnv } from "@/server/crm";
import { errorResponse } from "@/server/http";
import { mailerFromEnv } from "@/server/mailer";
import { sendDueEmails, startDueAiCalls } from "@/server/outreach";
import { voiceFromEnv } from "@/server/voice";

/**
 * The outbox: sends approved emails that are due and starts AI calls where Javad switched them on.
 * Called every 10 minutes (scope outreach:run) by the local start, the worker or n8n.
 */
export async function POST(req: Request) {
  try {
    const db = getDb();
    await authenticateAgent(db, req.headers.get("authorization"), "outreach:run");
    const mailer = mailerFromEnv();
    const voice = voiceFromEnv();
    const email = mailer ? await sendDueEmails(db, mailer) : { due: null, sent: 0, provider: "none" };
    const calls = voice ? await startDueAiCalls(db, voice, planEnv()) : { started: 0, provider: "none" };
    return Response.json({ email, calls });
  } catch (err) {
    return errorResponse(err);
  }
}
