import { getDb } from "@/db";
import { errorResponse } from "@/server/http";
import { captureLead } from "@/server/leads";

// Public: the hub hook posts here after the visitor ticks the consent box. No key; spam is held back by a honeypot.
export async function POST(req: Request) {
  try {
    const result = await captureLead(getDb(), { type: "system", id: "public-site" }, await req.json());
    return Response.json({ ok: true, repeat: result.repeat }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
