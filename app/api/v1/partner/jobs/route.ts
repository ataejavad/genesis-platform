import { getDb } from "@/db";
import { authenticateAgent } from "@/server/api-keys";
import { errorResponse } from "@/server/http";
import { offerCards } from "@/server/partner-chat";
import { partnerForKey, workFor } from "@/server/partners";

/**
 * Agent partners (doc 15 §6ب: "agents are partners too") read the same things a person sees in the portal:
 * open offers with the reasons for the match, and their assigned work. Scope partner:work.
 */
export async function GET(req: Request) {
  try {
    const db = getDb();
    const auth = await authenticateAgent(db, req.headers.get("authorization"), "partner:work");
    const p = await partnerForKey(db, auth.actor.apiKeyId);
    const work = (await workFor(db, p.id)).map(({ job, last, materials }) => ({ id: job.id, title: job.title, brief: job.brief, checklist: job.checklist, role: job.role, materials, status: job.status, dueAt: job.dueAt, payEur: job.payEur, lastDelivery: last && { version: last.version, status: last.status, review: last.review } }));
    return Response.json({ offers: await offerCards(db, p.id), work });
  } catch (err) {
    return errorResponse(err);
  }
}
