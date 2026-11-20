import { getDb } from "@/db";
import { requestCall } from "@/server/checkup";
import { errorResponse } from "@/server/http";

// Public: "call me" from an unlocked report, with the number the visitor typed in the chat; becomes a call task due now.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as { phone?: unknown };
    return Response.json(await requestCall(getDb(), { type: "system", id: "public-site" }, id, body));
  } catch (err) {
    return errorResponse(err);
  }
}
