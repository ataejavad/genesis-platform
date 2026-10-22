import { eur, finance } from "@/mock/cockpit";
import { PageHead } from "@/ui/Shell";

export default function Finance() {
  return (
    <main>
      <PageHead title="Finance" crumbs="Cockpit › Money & legal" sub="Invoices per milestone and subscription, partner payouts after QA, live margin. Payment rails are adapters." />
      <section className="grid g2" style={{ marginBottom: 18 }}>
        <div className="card"><h3>Invoices</h3><table className="table"><thead><tr><th>No.</th><th>To</th><th>Amount</th><th>Due</th><th>State</th><th>Rail</th></tr></thead>
          <tbody>{finance.invoices.map((i) => <tr key={i.no}><td className="small">{i.no}</td><td>{i.to}</td><td className="num">{eur(i.amount)}</td><td>{i.due}</td><td><span className={`badge ${i.state === "Paid" ? "ok" : "warn"}`}>{i.state}</span></td><td>{i.rail}</td></tr>)}</tbody></table>
          <p className="muted small" style={{ marginTop: 8 }}>E-invoice format comes from the customer's country pack (IT SDI, DE XRechnung, UK MTD).</p></div>
        <div className="card"><h3>Partner payouts</h3><table className="table"><thead><tr><th>To</th><th>Amount</th><th>Trigger</th><th>State</th></tr></thead>
          <tbody>{finance.payouts.map((p) => <tr key={p.to}><td>{p.to}</td><td className="num">{eur(p.amount)}</td><td className="small">{p.after}</td><td><span className="badge">{p.state}</span></td></tr>)}</tbody></table>
          <p className="muted small" style={{ marginTop: 8 }}>SEPA batch now, Stripe Connect later. Payouts above €2,000 need your approval; agents never pay.</p></div>
      </section>
      <section className="grid g2">
        <div className="card"><h3>Margin by customer</h3><table className="table"><thead><tr><th>Customer</th><th>Revenue</th><th>Cost</th><th>Margin</th></tr></thead>
          <tbody>{finance.margin.map((m) => <tr key={m.name}><td>{m.name}</td><td className="num">{eur(m.revenue)}</td><td className="num">{eur(m.cost)}</td><td className="num"><b>{Math.round(((m.revenue - m.cost) / m.revenue) * 100)}%</b></td></tr>)}</tbody></table></div>
        <div className="card"><h3>Payment rails</h3><div className="list">{finance.rails.map((r) => <div key={r.name} className="item"><b className="grow">{r.name}</b><span className={`badge ${r.state === "active" ? "ok" : "gray"}`}>{r.state}</span></div>)}</div></div>
      </section>
    </main>
  );
}
