import { getDb } from "@/db";
import { errorResponse } from "@/server/http";
import { applyPartner } from "@/server/partners";

// Public: the "work with us" conversation posts the finished application here (consent required).
export async function POST(req: Request) {
  try {
    const r = await applyPartner(getDb(), await req.json());
    // the same answer for new and known emails, so the form does not reveal who applied before
    return Response.json({ ok: true, id: r.duplicate ? null : r.id }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
