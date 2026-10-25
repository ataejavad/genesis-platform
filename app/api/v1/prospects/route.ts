import { getDb } from "@/db";
import { authenticateAgent } from "@/server/api-keys";
import { addProspect, planEnv } from "@/server/crm";
import { errorResponse } from "@/server/http";

/**
 * The company agent adds a company here (scope crm:write). The company gets its page and its outreach
 * sequence as drafts; nothing goes out until Javad approves it in the cockpit.
 */
export async function POST(req: Request) {
  try {
    const db = getDb();
    const auth = await authenticateAgent(db, req.headers.get("authorization"), "crm:write");
    const result = await addProspect(db, auth.actor, await req.json(), planEnv());
    return Response.json(result, { status: result.duplicate ? 200 : 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
