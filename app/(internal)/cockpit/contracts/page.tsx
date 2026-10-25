import Link from "next/link";
import { PACKS } from "@/config/jurisdictions";
import { getDb } from "@/db";
import { listContracts } from "@/server/contracts";
import { PageHead } from "@/ui/Shell";

const eur = (n: number) => `€${n.toLocaleString("en-GB")}`;
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "–");

// Contract factory (step 8): built from the clause library on "Send contract" (orders) or partner activation.
export default async function Contracts() {
  const rows = await listContracts(getDb());
  const open = rows.filter((r) => r.contract.status === "sent");
  return (
    <main>
      <PageHead title="Contracts" crumbs="Cockpit › Money & legal" sub="Customers get theirs when you press Send contract on an order; partners when you accept them. Signed in their portal with an email code, onerous clauses with a second code. Nothing starts before." />
      <section className="grid g4" style={{ marginBottom: 18 }}>
        <div className="card"><div className="muted small">Waiting for signature</div><b style={{ fontSize: 24 }}>{open.length}</b></div>
        <div className="card"><div className="muted small">Signed</div><b style={{ fontSize: 24 }}>{rows.filter((r) => r.contract.status === "signed").length}</b></div>
        <div className="card"><div className="muted small">Customer value signed</div><b style={{ fontSize: 24 }}>{eur(rows.filter((r) => r.contract.status === "signed").reduce((s, r) => s + r.contract.amountEur, 0))}</b></div>
        <div className="card"><div className="muted small">Templates not lawyer-reviewed</div><b style={{ fontSize: 24 }}>{Object.values(PACKS).filter((p) => !p.reviewed).length}</b></div>
      </section>
      <div className="card table-wrap" style={{ marginBottom: 18 }}>
        <table className="table"><thead><tr><th>Contract</th><th>Party</th><th>Kind</th><th>Value</th><th>Deposit</th><th>Template</th><th>Sent</th><th>Status</th></tr></thead>
          <tbody>{rows.map(({ contract: c, org, partner }) => (
            <tr key={c.id}>
              <td><Link href={`/cockpit/contracts/${c.id}`}>{c.title}</Link></td>
              <td>{org ?? partner ?? "–"}</td>
              <td>{c.kind}</td>
              <td className="num">{c.kind === "customer" ? <>{eur(c.amountEur)}{c.monthlyEur ? ` + ${eur(c.monthlyEur)}/mo` : ""}</> : "–"}</td>
              <td className="num">{c.depositEur ? eur(c.depositEur) : "–"}</td>
              <td className="small">{c.templateVersion} {!c.reviewed && <span className="badge warn">draft</span>}</td>
              <td className="small">{day(c.createdAt)}</td>
              <td><span className={`badge ${c.status === "signed" ? "ok" : c.status === "sent" ? "warn" : "gray"}`}>{c.status === "sent" && c.evidence?.signedAt ? "text signed, clauses open" : c.status}</span></td>
            </tr>
          ))}</tbody></table>
        {!rows.length && <p className="empty">No contracts yet. Send one from an order in Projects.</p>}
      </div>
      <div className="card table-wrap"><h3>Country packs</h3>
        <table className="table"><thead><tr><th>Country</th><th>Template</th><th>Law · court</th><th>VAT</th><th>Payment</th><th>E-invoice</th><th>Status</th></tr></thead>
          <tbody>{Object.values(PACKS).map((p) => <tr key={p.code}><td>{p.name}</td><td>{p.templateVersion}</td><td>{p.law.en} · {p.court}</td><td>{p.vatRate}% (EU B2B reverse charge)</td><td>{p.paymentDays} days</td><td className="small">{p.einvoice}</td><td><span className={`badge ${p.reviewed ? "ok" : "warn"}`}>{p.reviewed ? "lawyer-reviewed" : "needs lawyer review"}</span></td></tr>)}</tbody></table>
        <p className="muted small">Clause texts live in Git (src/config/jurisdictions.ts). Other countries use the Italian pack (we are the seller) until a customer there is near.</p></div>
    </main>
  );
}
