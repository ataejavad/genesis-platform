import { z } from "zod";
import { getDb } from "@/db";
import { authenticateAgent } from "@/server/api-keys";
import { errorResponse } from "@/server/http";
import { partnerForKey, respondOffer } from "@/server/partners";

/** Accept or decline an offer: {"accept": true}. The first partner to accept gets the job. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    const auth = await authenticateAgent(db, req.headers.get("authorization"), "partner:work");
    const p = await partnerForKey(db, auth.actor.apiKeyId);
    const { accept } = z.object({ accept: z.boolean() }).parse(await req.json());
    return Response.json(await respondOffer(db, auth.actor, p.id, (await params).id, accept));
  } catch (err) {
    return errorResponse(err);
  }
}
