import Link from "next/link";
import { getDb } from "@/db";
import { demandSignals, hubFreshness, markets } from "@/mock/cockpit";
import { hubStatus } from "@/server/hubs";
import { PageHead } from "@/ui/Shell";

const tone: Record<string, string> = { live: "ok", "seed ready": "warn", candidate: "", rejected: "gray" };
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
  const hubs = await hubStatus(getDb()).catch(() => []);
  return (
    <main>
      <PageHead title="Markets & hubs" crumbs="Cockpit › Growth" sub="Genesis stage 0: the market-selection agent scores sub-industry × country filters. Only the ones we work on go live." actions={<button className="btn primary">Run selection now</button>} />
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
      <div className="card table-wrap">
        <table className="table"><thead><tr><th>Filter</th><th>NACE</th><th>Demand</th><th>Competition</th><th>Access</th><th>Law</th><th>Margin</th><th>Total</th><th>Status</th><th>Value KPI (30 d)</th><th /></tr></thead>
          <tbody>{markets.map((m) => (
            <tr key={m.filter}>
              <td><b>{m.filter}</b></td><td className="small">{m.nace}</td><td className="num">{m.demand}</td><td className="num">{m.competition}</td><td className="num">{m.access}</td><td className="num">{m.law}</td><td className="num">{m.margin}</td><td className="num"><b>{m.total}</b></td>
              <td><span className={`badge ${tone[m.hub]}`}>{m.hub}</span></td>
              <td className="small">{m.value ? <>€{m.value.mrr.toLocaleString("en-US")} MRR · {m.value.leads} leads · <span className={`badge ${m.value.trend === "expand" ? "ok" : "warn"}`}>{m.value.trend}</span></> : "—"}</td>
              <td className="row" style={{ gap: 6 }}>
                {m.hub === "seed ready" && <><button className="btn sm">Review seed</button><button className="btn sm ok">Approve → live</button></>}
                {m.hub === "candidate" && <button className="btn sm">Start seeding</button>}
                {m.hub === "live" && <><Link className="btn sm" href={`/de-de/hub/glass/${m.filter.endsWith("Italy") ? "it" : "de"}`}>Open</Link><button className="btn sm">Pause</button></>}
              </td>
            </tr>
          ))}</tbody></table>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h3>Hub builder · freshness</h3><span className="more muted small">One template; the agent fills every block from each hub's trusted-source whitelist. Facts need 2 sources; changes wait in Approvals.</span></div>
        <table className="table"><thead><tr><th>Hub</th><th>Block</th><th>Trusted sources</th><th>Age</th><th>Max age</th><th>State</th><th /></tr></thead>
          <tbody>{hubFreshness.map((f) => <tr key={f.hub + f.block}><td>{f.hub}</td><td><b>{f.block}</b></td><td className="small">{f.sources}</td><td className="num">{f.age}</td><td className="num">{f.max}</td><td><span className={`badge ${f.state === "fresh" ? "ok" : "warn"}`}>{f.state}</span></td><td>{f.state !== "fresh" && <button className="btn sm">{f.state === "stale" ? "Refresh now" : "Find 2nd source"}</button>}</td></tr>)}</tbody></table>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h3>Demand from industries without a hub</h3><span className="more muted small">Sign-ups, chats and check-ups still work for them (generic content); each one is logged here.</span></div>
        <table className="table"><thead><tr><th>Industry</th><th>NACE</th><th>Country</th><th>Sign-ups</th><th>Chats</th><th>Check-ups</th><th>Last</th></tr></thead>
          <tbody>{demandSignals.map((d) => <tr key={d.nace + d.country}><td><b>{d.industry}</b></td><td>{d.nace}</td><td>{d.country}</td><td className="num">{d.signups}</td><td className="num">{d.chats}</td><td className="num">{d.checkups}</td><td className="num">{d.last}</td></tr>)}</tbody></table>
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>Weights and data sources live in the agent's prompt (Git). Going live and pausing are hard approvals.</p>
    </main>
  );
}
