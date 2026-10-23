import { notFound } from "next/navigation";
import { eur, partners, projects, tasks } from "@/mock/cockpit";
import { PageHead } from "@/ui/Shell";
import { Board } from "@/ui/Board";
import { Progress } from "@/ui/bits";

export default async function Project({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = projects.find((x) => x.id === id);
  if (!p) notFound();
  const names = Object.fromEntries(partners.map((x) => [x.code, x.name]));
  const totalCost = p.costs.reduce((s, c) => s + c.v, 0);
  return (
    <main>
      <PageHead title={`${p.id} · ${p.title}`} crumbs="Cockpit › Projects" sub={`${p.kind === "customer" ? p.customer + " (white-label)" : "Internal"} · ${p.package} · due ${p.due}`} actions={<><button className="btn">Change request</button><button className="btn">Generate contract</button></>} />
      <section className="grid g4" style={{ marginBottom: 18 }}>
        <div className="card stat"><div className="label">Progress</div><div className="value">{p.progress}%</div><Progress value={p.progress} /></div>
        <div className="card stat"><div className="label">Sell</div><div className="value num">{p.sell ? eur(p.sell) : "—"}</div></div>
        <div className="card stat"><div className="label">Cost so far</div><div className="value num">{eur(totalCost)}</div></div>
        <div className="card stat"><div className="label">Margin</div><div className="value num">{p.sell ? `${Math.round(((p.sell - totalCost) / p.sell) * 100)}%` : "—"}</div><div className="delta muted">Estimate {p.estimate}</div></div>
      </section>
      <section className="grid g3" style={{ marginBottom: 18 }}>
        <div className="card"><h3>Milestones (accept → invoice)</h3>{p.milestones.length ? <div className="list">{p.milestones.map((m) => <div key={m.t} className="item small"><div className="grow">{m.t}</div><span className="num">{eur(m.amount)}</span><span className={`badge ${m.state === "accepted" ? "ok" : m.state === "in review" ? "warn" : "gray"}`}>{m.state}</span></div>)}</div> : <p className="muted small">Internal project, no milestones billed.</p>}</div>
        <div className="card"><h3>Change requests</h3>{p.changes.length ? p.changes.map((c) => <div key={c.t} className="item small"><b>{c.t}</b><div className="muted">{c.impact} · {c.state}</div></div>) : <p className="muted small">None.</p>}</div>
        <div className="card"><h3>Costs</h3><table className="table"><tbody>{p.costs.map((c) => <tr key={c.k}><td>{c.k}</td><td className="num">{eur(c.v)}</td></tr>)}</tbody></table></div>
      </section>
      <Board tasks={tasks.filter((t) => t.project === p.id)} names={names} lang="en" />
    </main>
  );
}
