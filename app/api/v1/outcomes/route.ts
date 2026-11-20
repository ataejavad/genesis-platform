import { getDb } from "@/db";
import { authenticateAgent } from "@/server/api-keys";
import { errorResponse } from "@/server/http";
import { addOutcome } from "@/server/portal";

/**
 * The agent or person that delivered a result records it here (scope portal:write): which customer, which
 * metric (src/server/portal-metrics.ts), how many, and its € value by the metric's rule. It shows on the
 * customer's dashboard at once.
 */
export async function POST(req: Request) {
  try {
    const db = getDb();
    const auth = await authenticateAgent(db, req.headers.get("authorization"), "portal:write");
    return Response.json(await addOutcome(db, auth.actor, await req.json()), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
