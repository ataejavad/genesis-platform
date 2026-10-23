import { writeAdvice } from "@/agents/checkup-advisor";
import { getDb } from "@/db";
import { unlockCheckup } from "@/server/checkup";
import { errorResponse } from "@/server/http";

// Public: email + explicit consent unlock the plan of a check-up (and create the lead).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const report = await unlockCheckup(getDb(), { type: "system", id: "public-site" }, id, await req.json(), writeAdvice);
    return Response.json({ report });
  } catch (err) {
    return errorResponse(err);
  }
}
