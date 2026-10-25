import { getDb } from "@/db";
import { products } from "@/mock/site";
import { listCustomers, listServices, openRequests } from "@/server/portal";
import { METRICS } from "@/server/portal-metrics";
import { PageHead } from "@/ui/Shell";
import { askApproval, goal, recordResult, reply } from "./actions";
import { OpenAccount } from "./OpenAccount";

const eur = (n: number) => `€${n.toLocaleString("en-GB")}`;

// Step 5: the team side of the customer dashboard. Agents do the same through /api/v1/outcomes and
// /api/v1/customer-approvals (scope portal:write); until they run, results are recorded here by hand.
export default async function CockpitCustomers() {
  const db = getDb();
  const [customers, requests] = await Promise.all([listCustomers(db), openRequests(db)]);
  const services = Object.fromEntries(await Promise.all(customers.map(async (c) => [c.org.id, await listServices(db, c.org.id, "en")] as const)));
  const industries = [...new Set(products.flatMap((p) => p.industries))];
  return (
    <main className="stack">
      <PageHead title="Customers" crumbs="Cockpit" sub="Accounts, results, requests. Customers see all of this in their dashboard (/portal)." />

      <div className="card">
        <h3>Requests waiting on us ({requests.length})</h3>
        {requests.length === 0 && <p className="muted">None.</p>}
        <div className="list">
          {requests.map(({ request: r, company }) => (
            <form key={r.id} action={reply} className="item" style={{ alignItems: "start", flexWrap: "wrap" }}>
              <input type="hidden" name="id" value={r.id} />
              <div className="grow"><b>{company}</b> <span className="badge">{r.kind}</span> <span className="muted small">{r.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {r.status}</span><div>{r.text}</div></div>
              <textarea name="reply" defaultValue={r.reply ?? ""} placeholder="Answer the customer sees" style={{ minHeight: 48, flexBasis: "100%" }} />
              <button className="btn sm" name="status" value="in_progress">Save · in progress</button>
              <button className="btn sm primary" name="status" value="done">Answer · done</button>
            </form>
          ))}
        </div>
      </div>

      <div className="card table-wrap">
        <h3>Accounts ({customers.length})</h3>
        <table>
          <thead><tr><th>Company</th><th>Trade</th><th>Fee / month</th><th>Back this month</th><th>ROI</th><th>Open requests</th><th>Waiting on customer</th></tr></thead>
          <tbody>
            {customers.map((c) => <tr key={c.org.id}><td>{c.org.name} <span className="muted small">{c.org.country}</span></td><td>{c.org.industry}</td><td>{eur(c.feeEur)}</td><td>{eur(c.monthEur)}</td><td>{c.roi ?? "–"}×</td><td>{c.openRequests}</td><td>{c.waitingOnCustomer}</td></tr>)}
          </tbody>
        </table>
      </div>

      {customers.length > 0 && (
        <div className="grid g3">
          <form action={recordResult} className="card stack">
            <h3>Record a result</h3>
            <select name="org">{customers.map((c) => <option key={c.org.id} value={c.org.id}>{c.org.name}</option>)}</select>
            <select name="sub"><option value="">(no specific service)</option>{customers.flatMap((c) => services[c.org.id].map((s) => <option key={s.id} value={s.id}>{c.org.name}: {s.name}</option>))}</select>
            <select name="metric">{METRICS.map((m) => <option key={m.id} value={m.id}>{m.label.en}</option>)}</select>
            <div className="row"><input name="value" placeholder="How many" inputMode="decimal" required /><input name="eur" placeholder="€ value" inputMode="numeric" required /></div>
            <button className="btn primary">Record</button>
          </form>
          <form action={askApproval} className="card stack">
            <h3>Ask the customer to approve</h3>
            <select name="org">{customers.map((c) => <option key={c.org.id} value={c.org.id}>{c.org.name}</option>)}</select>
            <input name="title" placeholder="What (customer language)" required />
            <textarea name="detail" placeholder="Details" style={{ minHeight: 48 }} />
            <input name="link" placeholder="Link (optional)" dir="ltr" />
            <button className="btn primary">Send for approval</button>
          </form>
          <form action={goal} className="card stack">
            <h3>Add a shared goal</h3>
            <select name="org">{customers.map((c) => <option key={c.org.id} value={c.org.id}>{c.org.name}</option>)}</select>
            <input name="title" placeholder="Goal (customer language)" required />
            <select name="lang" aria-label="Goal language"><option>it</option><option>de</option><option>en</option><option>fa</option></select>
            <select name="metric">{METRICS.map((m) => <option key={m.id} value={m.id}>{m.label.en}</option>)}</select>
            <div className="row"><input name="baseline" placeholder="From" required /><input name="target" placeholder="To" required /><input name="unit" placeholder="Unit" defaultValue="%" /></div>
            <button className="btn primary">Add goal</button>
          </form>
        </div>
      )}

      <OpenAccount industries={industries} products={products.map((p) => ({ slug: p.slug, name: p.name.en, price: p.plans[0].price }))} />
    </main>
  );
}
