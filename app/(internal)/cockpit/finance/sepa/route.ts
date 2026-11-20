import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { payoutBatch } from "@/server/finance";

// SEPA credit transfer file (pain.001.001.09) for the bank: every due partner payout with an IBAN.
export async function GET() {
  await requireAdmin();
  const b = await payoutBatch(getDb());
  if (!b.xml) return new Response(b.reason ?? "nothing to pay", { status: 409 });
  return new Response(b.xml, { headers: { "content-type": "application/xml; charset=utf-8", "content-disposition": `attachment; filename="sepa-payouts-${new Date().toISOString().slice(0, 10)}.xml"` } });
}
