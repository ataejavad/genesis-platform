import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { memberships, projectInputs } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { authenticateAgent } from "@/server/api-keys";
import { getFile } from "@/server/files";
import { errorResponse } from "@/server/http";
import { partnerForKey, partnerForUser } from "@/server/partners";
import { partnerMayOpen } from "@/server/projects";

/**
 * A customer file. The team and the customer's own people get it as sent; a partner of the project only after a
 * person cleared it (text files never: partners read their cleaned text instead). Agents use their partner key.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    let row: typeof projectInputs.$inferSelect | null = null;
    const bearer = req.headers.get("authorization");
    if (bearer) {
      const auth = await authenticateAgent(db, bearer, "partner:work");
      row = await partnerMayOpen(db, (await partnerForKey(db, auth.actor.apiKeyId)).id, id);
    } else {
      const u = await getCurrentUser();
      if (!u) return new Response("Sign in first", { status: 401 });
      const [input] = await db.select().from(projectInputs).where(eq(projectInputs.id, id));
      if (input && u.role === "admin") row = input;
      else if (input?.orgId && (await db.select().from(memberships).where(and(eq(memberships.orgId, input.orgId), eq(memberships.userId, u.id)))).length) row = input;
      else {
        const partner = await partnerForUser(db, u.id);
        if (partner) row = await partnerMayOpen(db, partner.id, id);
      }
    }
    if (!row?.fileKey) return new Response("Not found", { status: 404 });
    const bytes = await getFile(row.fileKey);
    return new Response(new Uint8Array(bytes), {
      headers: { "content-type": row.fileType ?? "application/octet-stream", "content-disposition": `inline; filename="${encodeURIComponent(row.fileName ?? "file")}"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff", "content-security-policy": "sandbox" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
