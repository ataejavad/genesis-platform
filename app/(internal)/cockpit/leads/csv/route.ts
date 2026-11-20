import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { leads } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/server/events";

// CSV export of the leads with their consent (admin only; the export itself is audited, it holds personal data).
const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET() {
  const user = await requireAdmin();
  const db = getDb();
  const rows = await db.select().from(leads).orderBy(desc(leads.createdAt));
  await audit(db, { type: "user", id: user.id }, "leads.exported", { type: "leads", id: "all" }, null, { rows: rows.length });
  const head = ["email", "industry", "country", "locale", "hook", "tags", "reminders", "created", "confirmed", "unsubscribed", "consent_text"];
  const body = rows.map((l) => [l.email, l.industry, l.country, l.locale, l.hook, l.tags.join(" "), l.reminders, l.createdAt.toISOString(), l.confirmedAt?.toISOString(), l.unsubscribedAt?.toISOString(), l.consentText].map(cell).join(","));
  return new Response([head.join(","), ...body].join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
