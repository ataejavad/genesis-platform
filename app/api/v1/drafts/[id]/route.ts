import { getDb } from "@/db";
import { authenticateAgent } from "@/server/api-keys";
import { getApprovalStatus } from "@/server/content";
import { notFound } from "@/server/errors";
import { errorResponse } from "@/server/http";

// Status of a proposed draft, by the approvalId returned from POST /api/v1/drafts.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const db = getDb();
    await authenticateAgent(db, req.headers.get("authorization"), "content:read");
    const { id } = await ctx.params;
    const status = /^[0-9a-f-]{36}$/.test(id) ? await getApprovalStatus(db, id) : null;
    if (!status) throw notFound("approval");
    return Response.json(status);
  } catch (err) {
    return errorResponse(err);
  }
}
