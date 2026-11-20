import { getDb } from "@/db";
import { requireCustomer } from "@/lib/portal-auth";
import { exportData } from "@/server/portal";

// GDPR art. 15 and 20: everything we hold about the company, in one machine-readable file.
export async function GET() {
  const { org } = await requireCustomer();
  const data = await exportData(getDb(), org.id);
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${org.slug}-data.json"`, "cache-control": "no-store" },
  });
}
