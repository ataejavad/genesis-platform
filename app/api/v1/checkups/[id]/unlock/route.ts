import { writeAdvice } from "@/agents/checkup-advisor";
import { getDb } from "@/db";
import { runAgent } from "@/server/agents";
import { unlockCheckup } from "@/server/checkup";
import { errorResponse } from "@/server/http";

// Public: email + explicit consent unlock the plan of a check-up (and create the lead).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const db = getDb();
    const report = await unlockCheckup(db, { type: "system", id: "public-site" }, id, await req.json(), (r) => runAgent(db, "checkup-advisor", "advice", () => writeAdvice(r), { checkupId: id }));
    return Response.json({ report });
  } catch (err) {
    return errorResponse(err);
  }
}
