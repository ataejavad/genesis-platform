import Link from "next/link";
import { getDb } from "@/db";
import { AppError } from "@/server/errors";
import { projectDetail } from "@/server/projects";
import { notFound } from "next/navigation";
import { Progress } from "@/ui/bits";
import { PageHead } from "@/ui/Shell";
import { ChangeForm } from "../Forms";

const eur = (n: number) => `€${n.toLocaleString("en-GB")}`;
const badge = (s: string) => (["accepted", "approved", "closed"].includes(s) ? "ok" : ["ready", "delivered", "quoted", "offered"].includes(s) ? "warn" : s === "changes" || s === "rejected" ? "bad" : "gray");

export default async function Project({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await projectDetail(getDb(), id).catch((err) => {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  });
  const p = d.project;
  return (
    <main className="stack">
      <PageHead title={`${p.code} · ${p.title}`} crumbs="Cockpit › Projects" sub={`${d.company ? `${d.company} (white-label)` : "Internal"} · ${p.packageSlug ?? "custom"} · risk ${p.risk} (${p.riskWhy.join(", ")}) · due ${p.dueAt.toISOString().slice(0, 10)} · ${p.status}`} />
      <section className="grid g4">
        <div className="card stat"><div className="label">Progress (earned)</div><div className="value">{Math.round(d.health.progress * 100)}%</div><Progress value={Math.round(d.health.progress * 100)} /></div>
        <div className="card stat"><div className="label">Price</div><div className="value num">{eur(p.priceEur)}</div><div className="delta muted">then {eur(p.monthlyEur)}/month</div></div>
        <div className="card stat"><div className="label">Cost so far / budget</div><div className="value num">{eur(d.costEur)}</div><div className="delta muted">budget {eur(p.budgetEur)}</div></div>
        <div className="card stat"><div className="label">Expected margin</div><div className="value num">{Math.round(d.health.marginPct * 100)}%</div></div>
      </section>
      {d.health.flags.length > 0 && <div className="callout warn">⚠️ {d.health.flags.join(" · ")}</div>}

      <section className="grid g2">
        <div className="card">
          <h3>Milestones (customer accepts → invoiceable)</h3>
          <div className="list">{d.milestones.map((m) => <div key={m.id} className="item small"><div className="grow">{m.seq + 1}. {m.title}{m.readyAt && m.status === "ready" ? <span className="muted"> · waiting since {m.readyAt.toISOString().slice(0, 10)}</span> : null}</div><span className="num">{eur(m.amountEur)}</span><span className={`badge ${badge(m.status)}`}>{m.status}</span></div>)}</div>
        </div>
        <div className="card">
          <h3>Change requests</h3>
          {d.changes.map((c) => <div key={c.id} className="item small"><div className="grow">{c.text}<div className="muted">+{eur(c.priceEur)} · +{c.days} days</div></div><span className={`badge ${badge(c.status)}`}>{c.status}</span></div>)}
          {p.orgId ? <ChangeForm project={p.id} /> : <p className="muted small">Internal project: no customer approval needed.</p>}
        </div>
      </section>

      <div className="card table-wrap">
        <h3>Tasks</h3>
        <table className="table">
          <thead><tr><th>Task</th><th>Protocol</th><th>Partner</th><th>Status</th><th>Pay</th><th>Due</th><th>Last delivery</th></tr></thead>
          <tbody>{d.tasks.map((t) => <tr key={t.job.id}><td>{t.job.title}</td><td className="small">{t.protocol ? <Link href="/cockpit/protocols">{t.protocol.code} v{t.protocol.version}</Link> : "–"}</td><td>{t.partner ?? <span className="muted">offered</span>}</td><td><span className={`badge ${badge(t.job.status)}`}>{t.job.status}</span></td><td className="num">{eur(t.job.payEur)}</td><td className="small">{t.job.dueAt.toISOString().slice(0, 10)}</td><td className="small">{t.last ? <>v{t.last.version} · {t.last.status}{t.last.status === "submitted" && <> · <Link href="/cockpit/qa">QA queue</Link></>}</> : "–"}</td></tr>)}</tbody>
        </table>
      </div>

      <section className="grid g2">
        <div className="card"><h3>Costs</h3>{d.costs.length ? <table className="table"><tbody>{d.costs.map((c) => <tr key={c.id}><td>{c.kind}</td><td className="small">{c.note}</td><td className="num">{eur(c.amountEur)}</td></tr>)}</tbody></table> : <p className="muted small">None yet. Partner pay is booked when a delivery is accepted.</p>}</div>
        <div className="card"><h3>Lessons</h3>{p.lessons.length ? <ul className="small">{p.lessons.map((l) => <li key={l}>{l}</li>)}</ul> : <p className="muted small">{p.status === "closed" ? "Nothing repeated: protocols held." : "Written at closing from QA failures and delays."}</p>}</div>
      </section>
    </main>
  );
}
