import { getDb } from "@/db";
import { BRAND } from "@/mock/data";
import { errorResponse } from "@/server/http";
import { listPackages, listProtocols } from "@/server/projects";

// Machine-readable catalogue for buyer agents (doc 06 §3و): every package with its price, monthly fee,
// milestones and the acceptance criteria we guarantee. Orders go to POST /api/v1/orders.
export async function GET() {
  try {
    const db = getDb();
    const [packages, protocols] = await Promise.all([listPackages(db), listProtocols(db)]);
    const criteria = (code: string) => protocols.find((p) => p.protocol.code === code)?.approved?.criteria.filter((c) => c.mandatory).map((c) => c.text) ?? [];
    return Response.json({
      provider: BRAND,
      currency: "EUR",
      offerings: packages.map((p) => ({ id: p.slug, name: p.titles, setupEur: p.setupEur, monthlyEur: p.monthlyEur, milestones: p.milestones, guaranteed: p.tasks.flatMap((t) => criteria(t.protocol)), order: { method: "POST", url: "/api/v1/orders", body: { packageSlug: p.slug, company: "…", email: "…", country: "IT" } } })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
