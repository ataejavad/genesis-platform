import Link from "next/link";
import { getDb } from "@/db";
import { demandWithoutHub, marketFilters } from "@/server/market-filters";
import { FilterDecision } from "../systems/Forms";
import { hubStatus } from "@/server/hubs";
import { checkupFunnel } from "@/server/checkup";
import { PageHead } from "@/ui/Shell";

const steps = [
  ["🎯", "Pick", "Market-selection agent scores sub-industry × country"],
  ["🌱", "Seed", "Agents fill the hub: market facts, news, directory, solutions"],
  ["✅", "Approve", "You approve the seeded hub (hard gate)"],
  ["🟢", "Live", "Hub appears in Explore; visitors of that industry get it site-wide"],
  ["📈", "Expand or pause", "Value KPI decides: more countries, keep, or switch off"],
];

// Only sub-industries we actively work on go live. Adding one is data (a markets row + seed content), not code.
export const dynamic = "force-dynamic";

export default async function Markets() {
  const db = getDb();
  const [hubs, funnel, filters] = await Promise.all([hubStatus(db).catch(() => []), checkupFunnel(db).catch(() => []), marketFilters(db)]);
  const demand = await demandWithoutHub(db, hubs.map((h) => h.industry));
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
  return (
    <main>
      <PageHead title="Markets & hubs" crumbs="Cockpit › Growth" sub="Genesis stage 0: the market-selection agent scores sub-industry × country filters. Only the ones we work on go live." actions={<a className="btn" href="https://github.com/ataejavad/genesis-platform/actions/workflows/market-selection.yml" target="_blank" rel="noreferrer">Run selection (GitHub) ↗</a>} />
      <div className="flow card" style={{ marginBottom: 16, gridTemplateColumns: "repeat(5, minmax(150px, 1fr))" }}>
        {steps.map(([icon, name, what]) => (
          <div key={name} className="stage"><div className="node"><b>{icon} {name}</b><div className="muted small">{what}</div></div></div>
        ))}
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h3>Live hubs</h3><span className="badge ok">live database</span><span className="more muted small">Built by the hub-builder agent (npm run agents:hubs). KPI = opted-in leads this month from the hub&apos;s hook.</span></div>
        <table className="table"><thead><tr><th>Hub</th><th>Research</th><th>Pages live</th><th>Waiting for approval</th><th>KPI this month</th><th>Checks</th><th /></tr></thead>
          <tbody>{hubs.map((h) => (
            <tr key={h.industry + h.country}>
              <td><b>{h.name}</b> · {h.country}</td>
              <td className="num">{h.researchedAt}</td>
              <td className="small">{h.live.join(", ") || "—"}</td>
              <td className="small">{h.waiting.length ? <Link href="/cockpit/approvals">{h.waiting.join(", ")}</Link> : "—"}</td>
              <td className="small"><b>{h.leads}</b> / {h.kpi.target} <span className={`badge ${h.leads >= h.kpi.target ? "ok" : "warn"}`}>{Math.round((h.leads / h.kpi.target) * 100)}%</span><div className="muted">{h.kpi.name}</div></td>
              <td className="small">{h.issues.length ? h.issues.map((i) => <div key={i.where}>{i.level}: {i.where}, {i.why}</div>) : <span className="badge ok">all sourced</span>}</td>
              <td><Link className="btn sm" href={`/it-it/hub/${h.industry}/${h.country.toLowerCase()}`}>Open</Link></td>
            </tr>
          ))}</tbody></table>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h3>Free check-up · funnel this month</h3><span className="badge ok">live database</span><span className="more muted small">One engine, two entrances: the form page and the home chat. Completed → plan unlocked with email (lead) → call requested.</span></div>
        <table className="table"><thead><tr><th>Industry</th><th>Entrance</th><th>Completed</th><th>Unlocked (lead)</th><th>Call requested</th></tr></thead>
          <tbody>
            {funnel.length === 0 && <tr><td colSpan={5} className="muted">No check-ups yet this month.</td></tr>}
            {funnel.map((f) => (
              <tr key={f.industry + f.entrance}>
                <td><b>{f.industry}</b></td><td>{f.entrance}</td><td className="num">{f.completed}</td>
                <td className="num">{f.unlocked} <span className="muted">({pct(f.unlocked, f.completed)})</span></td>
                <td className="num">{f.calls} <span className="muted">({pct(f.calls, f.unlocked)})</span></td>
              </tr>
            ))}
          </tbody></table>
      </div>
      {filters.map((f) => (
        <div key={f.country} className="card table-wrap" style={{ marginBottom: 16 }}>
          <div className="card-head"><h3>Market selection · {f.country}</h3><span className="badge ok">run {f.day}</span><span className="more muted small">Data year {String(f.period)} · {f.dropped} divisions dropped (no data or no target firms) · approve or pause each filter: a paused filter stops the company finder.</span></div>
          <table className="table"><thead><tr><th>#</th><th>Filter (NACE division)</th><th>Score</th><th>Confidence</th><th>Your decision</th><th /></tr></thead>
            <tbody>{f.rows.map((r) => (
              <tr key={r.id}>
                <td className="muted">{r.rank}</td><td><b>{r.id}</b> {r.name}</td><td className="num"><b>{r.total}</b></td><td className="num">{Math.round(r.confidence * 100)}%</td>
                <td><span className={`badge ${r.decision === "approved" ? "ok" : r.decision === "paused" ? "gray" : ""}`}>{r.decision}</span></td>
                <td><FilterDecision country={f.country} nace={r.id} decision={r.decision} /></td>
              </tr>
            ))}</tbody></table>
        </div>
      ))}
      {!filters.length && <div className="card muted">No market-selection run found in data/market-selection/runs (GitHub Actions writes one each month).</div>}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h3>Demand from industries without a hub</h3><span className="more muted small">Check-ups and leads from trades we have no hub for, last 90 days: input for the next market-selection run.</span></div>
        <table className="table"><thead><tr><th>Industry</th><th>Country</th><th>Check-ups</th><th>Leads</th></tr></thead>
          <tbody>{demand.map((d) => <tr key={d.industry + d.country}><td><b>{d.industry}</b></td><td>{d.country}</td><td className="num">{d.checkups}</td><td className="num">{d.leads}</td></tr>)}
            {!demand.length && <tr><td colSpan={4} className="muted">None yet.</td></tr>}</tbody></table>
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>Weights and data sources live in Git (src/server/market-selection). Approving and pausing a filter are your hard gate.</p>
    </main>
  );
}
