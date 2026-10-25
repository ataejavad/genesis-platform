import Link from "next/link";
import { getDb } from "@/db";
import { getCompany, listInvoices, payoutBatch } from "@/server/finance";
import { duePayouts } from "@/server/partners";
import { PageHead } from "@/ui/Shell";
import { BatchPaid, CompanyForm, InvoiceActions } from "./Forms";

const eur = (n: number) => `€${n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "–");
const BADGE: Record<string, string> = { requested: "warn", paid: "", issued: "ok", cancelled: "gray" };

// Finance (step 8): payment requests → paid → legal invoice; deposits start projects; partner payouts as one SEPA file.
export default async function Finance() {
  const db = getDb();
  const now = new Date();
  const [{ rows, kpi }, co, due, batch] = await Promise.all([listInvoices(db, now), getCompany(db), duePayouts(db), payoutBatch(db, now)]);
  return (
    <main>
      <PageHead title="Finance" crumbs="Cockpit › Money & legal" sub="Deposit before work, each accepted milestone, then the monthly fee. Customers pay by bank transfer with a QR code; reminders go by date. Mark money as paid when it is in the bank." actions={<Link className="btn" href="/cockpit/outbox">Outbox</Link>} />
      <section className="grid g4" style={{ marginBottom: 18 }}>
        <div className="card"><div className="muted small">Open requests</div><b style={{ fontSize: 24 }}>{eur(kpi.openEur)}</b></div>
        <div className="card"><div className="muted small">Overdue</div><b style={{ fontSize: 24, color: kpi.overdueEur ? "var(--bad)" : undefined }}>{eur(kpi.overdueEur)}</b></div>
        <div className="card"><div className="muted small">Paid this month (net)</div><b style={{ fontSize: 24 }}>{eur(kpi.paidThisMonthEur)}</b></div>
        <div className="card"><div className="muted small">Paid, waiting for legal number</div><b style={{ fontSize: 24 }}>{kpi.waitingRegistration}</b></div>
      </section>
      {!co?.registered && <div className="callout small" style={{ marginBottom: 18 }}>Business not registered yet: payment requests work, legal invoice numbers wait. After registration, tick “registered” below; then pick an SdI e-invoice provider (adapter, no code change in the flow).</div>}
      <div className="card table-wrap" style={{ marginBottom: 18 }}>
        <h3>Payment requests and invoices</h3>
        <table className="table"><thead><tr><th>Customer</th><th>What</th><th>Total</th><th>VAT</th><th>Reference</th><th>Due</th><th>Reminders</th><th>Status</th><th /></tr></thead>
          <tbody>{rows.map(({ invoice: i, company }) => (
            <tr key={i.id}>
              <td>{company}</td>
              <td className="small">{i.kind} · {i.title}</td>
              <td className="num">{eur(i.totalEur)}</td>
              <td className="small">{i.vatRate}%{i.vatNote ? " (note)" : ""}</td>
              <td className="small ltr">{i.reference}</td>
              <td className="small" style={{ color: i.status === "requested" && i.dueAt < now ? "var(--bad)" : undefined }}>{day(i.dueAt)}</td>
              <td className="small">{i.reminderLevel ? `level ${i.reminderLevel}` : "–"}</td>
              <td><span className={`badge ${BADGE[i.status] ?? ""}`}>{i.status === "issued" ? `invoice ${i.number}` : i.status}</span></td>
              <td>{i.status === "requested" && <InvoiceActions id={i.id} />}</td>
            </tr>
          ))}</tbody></table>
        {!rows.length && <p className="empty">No payment requests yet. They start when a customer signs a contract.</p>}
      </div>
      <section className="grid g2">
        <div className="card stack">
          <h3>Partner payouts</h3>
          <div className="list">{due.map((d) => <div className="item small" key={d.payout.id}><div className="grow">{d.partner} · {d.title ?? "job"}<div className="muted">due {day(d.payout.dueAt)}</div></div><b className="num">{eur(d.payout.amountEur)}</b></div>)}</div>
          {!due.length && <p className="muted small">Nothing due.</p>}
          {batch.missing.length > 0 && <p className="small" style={{ color: "var(--warn)" }}>No IBAN yet (they add it in their profile): {batch.missing.join(", ")}</p>}
          {batch.xml ? (
            <div className="row"><a className="btn primary" href="/cockpit/finance/sepa">Download SEPA file ({batch.ids.length})</a><BatchPaid ids={batch.ids} /></div>
          ) : due.length > 0 && <p className="muted small">{batch.reason}</p>}
          <p className="muted small">Upload the file in your bank’s business banking (one approval for all). Stripe Connect later.</p>
        </div>
        <CompanyForm co={co} />
      </section>
    </main>
  );
}
