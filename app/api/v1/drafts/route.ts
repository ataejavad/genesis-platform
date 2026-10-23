import { getDb } from "@/db";
import { authenticateAgent } from "@/server/api-keys";
import { createDraft } from "@/server/content";
import { errorResponse } from "@/server/http";

/**
 * Agents propose page content here. The draft is never live until a human approves it
 * in the cockpit or on Telegram.
 */
export async function POST(req: Request) {
  try {
    const db = getDb();
    const auth = await authenticateAgent(db, req.headers.get("authorization"), "content:draft");
    const result = await createDraft(db, auth.actor, await req.json(), { allowedMarketId: auth.marketId });
    return Response.json(result, { status: result.unchanged ? 200 : 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
