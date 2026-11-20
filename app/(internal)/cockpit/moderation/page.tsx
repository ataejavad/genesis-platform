import { and, desc, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { partnerMessages, partners } from "@/db/schema";
import { PageHead } from "@/ui/Shell";
import { Seen } from "../systems/Forms";

// Moderation (step 6 contact masking, wired in step 10): partner messages where contact details were hidden or a
// person asked for a human review. Masking happens before anyone sees the message; here Javad looks at the pattern.
export default async function Moderation() {
  const db = getDb();
  const rows = await db
    .select({ m: partnerMessages, name: partners.name })
    .from(partnerMessages)
    .innerJoin(partners, eq(partners.id, partnerMessages.partnerId))
    .where(and(eq(partnerMessages.author, "partner"), or(eq(partnerMessages.flagged, true), eq(partnerMessages.reviewRequest, true))))
    .orderBy(desc(partnerMessages.createdAt))
    .limit(100);
  return (
    <main>
      <PageHead title="Moderation" crumbs="Cockpit › Delivery" sub="Contact details in partner messages are masked before anyone reads them (anti-bypass). Repeated attempts by one partner are a reason to talk to them. Review requests: a person asked for a human to look at an automated decision." />
      <div className="card table-wrap"><table className="table"><thead><tr><th>When</th><th>Partner</th><th>Original</th><th>Delivered</th><th>Reason</th><th /></tr></thead>
        <tbody>{rows.map(({ m, name }) => (
          <tr key={m.id} style={{ opacity: m.readAt ? 0.55 : 1 }}>
            <td className="small">{m.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td><td><b>{name}</b></td>
            <td className="small" style={{ maxWidth: 280 }}>{m.body}</td><td className="small" style={{ maxWidth: 280 }}>{m.shown}</td>
            <td>{m.reviewRequest ? <span className="badge warn">human review asked</span> : <span className="badge bad">contact masked</span>}</td>
            <td>{m.readAt ? <span className="muted small">seen</span> : <Seen id={m.id} />}</td>
          </tr>
        ))}
          {!rows.length && <tr><td colSpan={6} className="muted">Nothing flagged.</td></tr>}</tbody></table></div>
    </main>
  );
}
