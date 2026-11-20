import { getDb } from "@/db";
import { authenticateAgent } from "@/server/api-keys";
import { errorResponse } from "@/server/http";
import { pausedFilters } from "@/server/market-filters";

// The company finder asks which market filters Javad paused (hard gate from Cockpit › Markets).
export async function GET(req: Request) {
  try {
    const db = getDb();
    await authenticateAgent(db, req.headers.get("authorization"), "crm:write");
    return Response.json({ paused: await pausedFilters(db) });
  } catch (err) {
    return errorResponse(err);
  }
}
