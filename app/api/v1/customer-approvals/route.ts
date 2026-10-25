import { getDb } from "@/db";
import { authenticateAgent } from "@/server/api-keys";
import { errorResponse } from "@/server/http";
import { askCustomerApproval } from "@/server/portal";

/** An agent puts a delivery or a message in the customer's name in front of the customer for a yes (scope portal:write). */
export async function POST(req: Request) {
  try {
    const db = getDb();
    const auth = await authenticateAgent(db, req.headers.get("authorization"), "portal:write");
    return Response.json(await askCustomerApproval(db, auth.actor, await req.json()), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
