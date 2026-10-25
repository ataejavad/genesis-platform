import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { leads } from "@/db/schema";
import { PageHead } from "@/ui/Shell";

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "–");

// Leads (step 2 hooks, wired in step 10): who gave us their email, for what, with the consent text they agreed to.
export default async function Leads() {
  const rows = await getDb().select().from(leads).orderBy(desc(leads.createdAt)).limit(300);
  const confirmed = rows.filter((l) => l.confirmedAt && !l.unsubscribedAt).length;
  return (
    <main>
      <PageHead title="Leads" crumbs="Cockpit › Growth" sub="Emails from hub hooks and check-ups. Only confirmed leads (double opt-in) get reminders and offers; every email has a one-click unsubscribe. Unconfirmed leads are deleted after 30 days." actions={<a className="btn" href="/cockpit/leads/csv">Export CSV</a>} />
      <section className="grid g4" style={{ marginBottom: 18 }}>
        <div className="card stat"><div className="label">Leads</div><div className="value">{rows.length}</div></div>
        <div className="card stat"><div className="label">Confirmed, reachable</div><div className="value">{confirmed}</div></div>
        <div className="card stat"><div className="label">Want deadline reminders</div><div className="value">{rows.filter((l) => l.reminders && l.confirmedAt && !l.unsubscribedAt).length}</div></div>
        <div className="card stat"><div className="label">Unsubscribed</div><div className="value">{rows.filter((l) => l.unsubscribedAt).length}</div></div>
      </section>
      <div className="card table-wrap"><table className="table"><thead><tr><th>Email</th><th>Hub</th><th>Hook</th><th>Tags</th><th>Reminders</th><th>Captured</th><th>Consent</th></tr></thead>
        <tbody>{rows.map((l) => (
          <tr key={l.id}>
            <td className="ltr small">{l.email}</td><td className="small">{l.industry} · {l.country}</td><td className="small">{l.hook}</td><td className="small">{l.tags.join(", ")}</td>
            <td className="small">{l.reminders ? "yes" : "–"}</td><td className="small">{day(l.createdAt)}</td>
            <td><span className={`badge ${l.unsubscribedAt ? "gray" : l.confirmedAt ? "ok" : "warn"}`} title={l.consentText}>{l.unsubscribedAt ? "unsubscribed" : l.confirmedAt ? `confirmed ${day(l.confirmedAt)}` : "not confirmed"}</span></td>
          </tr>
        ))}
          {!rows.length && <tr><td colSpan={7} className="muted">No leads yet.</td></tr>}</tbody></table></div>
    </main>
  );
}
