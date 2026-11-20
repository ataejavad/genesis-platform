import { getDb } from "@/db";
import { errorResponse } from "@/server/http";
import { createOrder } from "@/server/projects";

// Public: the marketplace order conversation posts here. The order waits in Cockpit › Projects, where one
// click opens the customer's account and starts the project.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const o = await createOrder(getDb(), { type: "system", id: "marketplace" }, { ...body, source: "market", orgId: undefined });
    return Response.json({ ok: true, id: o.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
