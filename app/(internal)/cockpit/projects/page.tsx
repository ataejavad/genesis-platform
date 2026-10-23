import Link from "next/link";
import { eur, partners, projects, tasks } from "@/mock/cockpit";
import { PageHead } from "@/ui/Shell";
import { Board } from "@/ui/Board";
import { Progress } from "@/ui/bits";

export default function Projects() {
  const names = Object.fromEntries(partners.map((p) => [p.code, p.name]));
  return (
    <main>
      <PageHead title="Projects" crumbs="Cockpit › Delivery" sub="Projects start from catalogue packages (protocol + task template + base price). Approvals are risk-tiered; cost and margin are live." actions={<button className="btn primary">＋ New from package</button>} />
      <div className="card table-wrap" style={{ marginBottom: 18 }}>
        <table className="table"><thead><tr><th>Project</th><th>Package</th><th>Risk</th><th>Owner</th><th>Progress</th><th>Sell</th><th>Cost</th><th>Margin</th><th>Estimate</th></tr></thead>
          <tbody>{projects.map((p) => <tr key={p.id}><td><Link href={`/cockpit/projects/${p.id}`}><b>{p.id}</b></Link> {p.title}<div className="muted small">{p.kind === "customer" ? p.customer : "internal"}</div></td><td className="small">{p.package}</td><td><span className={`badge ${p.risk === "high" ? "bad" : p.risk === "medium" ? "warn" : "gray"}`}>{p.risk}</span></td><td className="small">{p.owner}</td><td style={{ width: 110 }}><Progress value={p.progress} /></td><td className="num">{p.sell ? eur(p.sell) : "—"}</td><td className="num">{eur(p.cost)}</td><td className="num">{p.sell ? `${Math.round(((p.sell - p.cost) / p.sell) * 100)}%` : "—"}</td><td className="small">{p.estimate}</td></tr>)}</tbody></table>
      </div>
      <h2>All tasks</h2>
      <Board tasks={tasks} names={names} lang="en" />
    </main>
  );
}
