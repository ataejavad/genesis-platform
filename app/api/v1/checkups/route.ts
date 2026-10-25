import { getDb } from "@/db";
import { startCheckup } from "@/server/checkup";
import { errorResponse } from "@/server/http";

// Public: both entrances (form page and concierge chat) post finished answers here and get the report back.
export async function POST(req: Request) {
  try {
    return Response.json(await startCheckup(getDb(), { type: "system", id: "public-site" }, await req.json()), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
