import { getDb } from "@/db";
import { products } from "@/mock/site";
import { latestHealth } from "@/server/health";
import { listCustomers, listServices, openRequests } from "@/server/portal";
import { METRICS } from "@/server/portal-metrics";
import { PageHead } from "@/ui/Shell";
import { LOSS_REASONS } from "@/config/loss-reasons";
import { MARGIN_FLOOR, margins, notices, periodOf } from "@/server/service";
import { askApproval, cancelFor, complaint, cost, goal, keep, quote, recordResult, reply } from "./actions";
import { listComplaints } from "@/server/complaints";
import { listPackages } from "@/server/projects";
import { EraseForm } from "./EraseForm";
import { OpenAccount } from "./OpenAccount";

const eur = (n: number) => `€${n.toLocaleString("en-GB")}`;

// Step 5: the team side of the customer dashboard. Agents do the same through /api/v1/outcomes and
// /api/v1/customer-approvals (scope portal:write); until they run, results are recorded here by hand.
export default async function CockpitCustomers() {
  const db = getDb();
  const period = periodOf(new Date());
  const [customers, requests, health, open, packages, margin, leaving] = await Promise.all([listCustomers(db), openRequests(db), latestHealth(db), listComplaints(db), listPackages(db), margins(db, period), notices(db)]);
  const now = Date.now();
  const costLabels = [...new Set(packages.flatMap((p) => [...p.monthly.costs.map((c) => c.label), ...p.monthly.tasks.map((t) => t.title)]))];
  const healthOf = new Map(health.map((h) => [h.h.orgId, h.h]));
  const services = Object.fromEntries(await Promise.all(customers.map(async (c) => [c.org.id, await listServices(db, c.org.id, "en")] as const)));
  const industries = [...new Set(products.flatMap((p) => p.industries))];
  return (
    <main className="stack">
      <PageHead title="Customers" crumbs="Cockpit" sub="Accounts, results, requests. Customers see all of this in their dashboard (/portal)." />

      <div className="card" id="complaints">
        <h3>Complaints ({open.length})</h3>
        <p className="muted small">The customer climbs one ladder in the chat: free fix by the same partner (3 days) → another partner redoes it at our cost (7 days) → you (1 working day). Accepting the fixed step closes it.</p>
        {open.length === 0 && <p className="muted">None.</p>}
        <div className="list">
          {open.map(({ c, company, code }) => (
            <form key={c.id} action={complaint} className="item row" style={{ alignItems: "start", flexWrap: "wrap" }}>
              <input type="hidden" name="id" value={c.id} />
              <div className="grow"><b>{company}</b> <span className="muted small">{code}</span> <span className={`badge ${c.step === "founder" ? "bad" : "warn"}`}>{c.step}</span> <span className={`small ${c.dueAt.getTime() < now ? "bad" : "muted"}`}>due {c.dueAt.toISOString().slice(0, 16).replace("T", " ")}</span><div className="small" style={{ whiteSpace: "pre-wrap" }}>{c.text}</div></div>
              <input name="note" placeholder="What you did / agreed" style={{ flexBasis: "100%" }} />
              {c.step !== "founder" && <button className="btn sm" name="do" value="escalate">Next step</button>}
              <button className="btn sm primary" name="do" value="resolve">Resolved</button>
            </form>
          ))}
        </div>
      </div>

      <div className="card" id="notices">
        <h3>Gave notice ({leaving.length})</h3>
        <p className="muted small">They cancel from their dashboard with 30 days&apos; notice (contract). Call them before it ends; if they stay, press &quot;Stays&quot;. The reason feeds the sales lessons.</p>
        {leaving.length === 0 && <p className="muted">None.</p>}
        <div className="list">
          {leaving.map(({ s, company }) => (
            <form key={s.id} action={keep} className="item row">
              <input type="hidden" name="id" value={s.id} />
              <div className="grow"><b>{company}</b> <span className="muted small">{s.product} · {eur(s.monthlyEur)}/month · ends {s.endsAt!.toISOString().slice(0, 10)}</span> <span className="badge warn">{s.cancelReason ?? "no reason"}</span>{s.cancelNote && <div className="small">&quot;{s.cancelNote}&quot;</div>}</div>
              <button className="btn sm ok">Stays (withdraw notice)</button>
            </form>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Requests waiting on us ({requests.length})</h3>
        {requests.length === 0 && <p className="muted">None.</p>}
        <div className="list">
          {requests.map(({ request: r, company }) => (
            <div key={r.id} className="item" style={{ display: "block" }}>
            <form action={reply} className="row" style={{ alignItems: "start" }}>
              <input type="hidden" name="id" value={r.id} />
              <div className="grow"><b>{company}</b> <span className="badge">{r.kind}</span> <span className="muted small">{r.createdAt.toISOString().slice(0, 16).replace("T", " ")} · {r.status}</span>{r.dueAt && (r.kind === "solution" || r.kind === "change") && r.status === "open" && <span className={`small ${r.dueAt.getTime() < now ? "bad" : "muted"}`}> · price promised by {r.dueAt.toISOString().slice(0, 16).replace("T", " ")}</span>}<div>{r.text}</div></div>
              <textarea name="reply" defaultValue={r.reply ?? ""} placeholder="Answer the customer sees" style={{ minHeight: 48, flexBasis: "100%" }} />
              <button className="btn sm" name="status" value="in_progress">Save · in progress</button>
              <button className="btn sm primary" name="status" value="done">Answer · done</button>
            </form>
            {r.kind === "solution" && (
              <form action={quote} className="row small" style={{ marginTop: 6 }}>
                <input type="hidden" name="id" value={r.id} />
                <select name="package" aria-label="Catalogue result">{packages.map((p) => <option key={p.slug} value={p.slug}>{p.title} · €{p.setupEur} + €{p.monthlyEur}/mo</option>)}</select>
                <button className="btn sm primary">Quote with this result (order + contract)</button>
                <span className="muted">or answer with a custom price above</span>
              </form>
            )}
            {r.kind === "data_delete" && <EraseForm org={r.orgId} request={r.id} company={company} />}
            </div>
          ))}
        </div>
      </div>

      <div className="card table-wrap">
        <h3>Accounts ({customers.length})</h3>
        <table>
          <thead><tr><th>Company</th><th>Trade</th><th>Fee / month</th><th title="Partner check-ups, tools and usage; estimates until the real bill is recorded">Cost {period}</th><th>Margin</th><th>Back this month</th><th>ROI</th><th>Open requests</th><th>Waiting on customer</th><th>Health</th></tr></thead>
          <tbody>
            {customers.map((c) => <tr key={c.org.id}><td>{c.org.name} <span className="muted small">{c.org.country}</span></td><td>{c.org.industry}</td><td>{eur(c.feeEur)}</td>{(() => { const m = margin.get(c.org.id); return m ? <><td title={m.lines.map((l) => `${l.label}: €${l.eur} (${l.source})`).join("\n")}>{eur(Math.round(m.costEur))}{m.estimated && <span className="muted small"> est.</span>}</td><td><span className={`badge ${m.marginPct !== null && m.marginPct < MARGIN_FLOOR ? "bad" : "ok"}`}>{m.marginPct ?? "–"}%</span></td></> : <><td className="muted">–</td><td className="muted">–</td></>; })()}<td>{eur(c.monthEur)}</td><td>{c.roi ?? "–"}×</td><td>{c.openRequests}</td><td>{c.waitingOnCustomer}</td><td>{(() => { const h = healthOf.get(c.org.id); return h ? <span className={`badge ${h.band === "red" ? "bad" : h.band === "watch" ? "warn" : "ok"}`} title={((h.signals as { reasons?: string[] }).reasons ?? []).join("; ")}>{h.score}</span> : <span className="muted small">Monday</span>; })()}</td></tr>)}
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
          <form action={cost} className="card stack">
            <h3>Record a running cost</h3>
            <p className="muted small">A real bill (voice minutes, number, tool) replaces the estimate with the same name for that month.</p>
            <select name="sub" required>{customers.flatMap((c) => services[c.org.id].map((s) => <option key={s.id} value={s.id}>{c.org.name}: {s.name}</option>))}</select>
            <input name="label" list="cost-labels" placeholder="Cost line, e.g. Voice minutes (estimate)" required />
            <datalist id="cost-labels">{costLabels.map((l) => <option key={l} value={l} />)}</datalist>
            <div className="row"><select name="kind" aria-label="Kind"><option value="usage">usage</option><option value="tool">tool</option><option value="partner">partner</option><option value="other">other</option></select><input name="eur" placeholder="€" inputMode="decimal" required /><input name="period" defaultValue={period} aria-label="Month" /></div>
            <button className="btn primary">Record cost</button>
          </form>
          <form action={cancelFor} className="card stack">
            <h3>Customer cancels (by phone or email)</h3>
            <select name="sub" required>{customers.flatMap((c) => services[c.org.id].map((s) => <option key={s.id} value={`${c.org.id}:${s.id}`}>{c.org.name}: {s.name}</option>))}</select>
            <select name="reason" required defaultValue=""><option value="" disabled>Why?</option>{LOSS_REASONS.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}</select>
            <input name="note" placeholder="In their words" />
            <button className="btn">Record notice (30 days)</button>
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
