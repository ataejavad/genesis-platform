import { getDb } from "@/db";
import { requestCall } from "@/server/checkup";
import { errorResponse } from "@/server/http";

// Public: "call me" from an unlocked report; sales picks it up from the lead.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return Response.json(await requestCall(getDb(), { type: "system", id: "public-site" }, id));
  } catch (err) {
    return errorResponse(err);
  }
}
