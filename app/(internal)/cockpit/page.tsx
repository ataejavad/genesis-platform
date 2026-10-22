import Link from "next/link";
import { alerts, approvals, brief, eur, kpis, projects } from "@/mock/cockpit";
import { PageHead } from "@/ui/Shell";
import { Progress, Stat } from "@/ui/bits";

// "Simple window": what happened, what needs Javad, how far from the goal.
export default function Today() {
  return (
    <main>
      <PageHead title="Today" crumbs="Cockpit" sub="One screen: the brief, what needs you, and the numbers." actions={<Link className="btn primary" href="/cockpit/approvals">Approvals ({kpis.approvalsWaiting})</Link>} />
      <div className="callout ai" style={{ marginBottom: 18 }}>✦ <b>Daily brief (Reports agent, 07:30):</b> {brief}</div>
      <section className="grid g4" style={{ marginBottom: 18 }}>
        <Stat label="MRR" value={eur(kpis.mrr)} delta={`Goal ${eur(kpis.mrrGoal)}`} />
        <Stat label="Pipeline" value={eur(kpis.pipeline)} delta="3 proposals" up />
        <Stat label="Gross margin" value={`${kpis.margin}%`} delta="floor 35%" up />
        <Stat label="AI spend (month)" value={`€${kpis.aiSpend}`} delta={`of €${kpis.aiBudget} budget`} />
      </section>
      <section className="grid g-2-1" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card-head"><h3>✋ Needs you</h3><Link className="more" href="/cockpit/approvals">All</Link></div>
          <div className="list">{approvals.map((a) => <div key={a.t} className="item"><span className={`badge ${a.risk === "high" ? "bad" : a.risk === "medium" ? "warn" : "gray"}`}>{a.kind}</span><div className="grow small"><b>{a.t}</b><div className="muted">{a.by} · {a.why}</div></div><button className="btn sm ok">Approve</button></div>)}</div>
        </div>
        <div className="stack">
          <div className="card"><h3>Alerts</h3><div className="stack">{alerts.map((a) => <div key={a.t} className={`callout small ${a.tone === "warn" || a.tone === "bad" ? "warn" : ""}`}>{a.t}</div>)}</div></div>
          <div className="card"><h3>Goal: €10k MRR</h3><Progress value={Math.round((kpis.mrr / kpis.mrrGoal) * 100)} /><div className="muted small" style={{ marginTop: 6 }}>Your approval time this week: {kpis.javadHoursWeek} h (target &lt; 5 h)</div></div>
        </div>
      </section>
      <div className="card">
        <div className="card-head"><h3>Projects</h3><Link className="more" href="/cockpit/projects">All</Link></div>
        <table className="table"><thead><tr><th>Project</th><th>Owner</th><th>Status</th><th>Progress</th><th>Margin</th></tr></thead>
          <tbody>{projects.map((p) => <tr key={p.id}><td><Link href={`/cockpit/projects/${p.id}`}>{p.id}</Link> {p.title}</td><td>{p.owner}</td><td><span className="badge gray">{p.status}</span></td><td style={{ width: 140 }}><Progress value={p.progress} /></td><td className="num">{p.sell ? `${Math.round(((p.sell - p.cost) / p.sell) * 100)}%` : "internal"}</td></tr>)}</tbody></table>
      </div>
    </main>
  );
}
