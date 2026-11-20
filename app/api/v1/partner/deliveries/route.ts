import { z } from "zod";
import { getDb } from "@/db";
import { authenticateAgent } from "@/server/api-keys";
import { errorResponse } from "@/server/http";
import { deliver, deliveryInput, partnerForKey } from "@/server/partners";

/** Deliver work: {"jobId", "link", "note"?, "selfCheck": [true, …]} with one tick per checklist point. */
export async function POST(req: Request) {
  try {
    const db = getDb();
    const auth = await authenticateAgent(db, req.headers.get("authorization"), "partner:work");
    const p = await partnerForKey(db, auth.actor.apiKeyId);
    const body = deliveryInput.extend({ jobId: z.string().uuid() }).parse(await req.json());
    return Response.json(await deliver(db, auth.actor, p.id, body.jobId, body), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
