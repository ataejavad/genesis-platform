import { notFound } from "next/navigation";
import { protocols } from "@/mock/cockpit";
import { PageHead } from "@/ui/Shell";

export default async function ProtocolCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = protocols.find((x) => x.id === id);
  if (!p) notFound();
  return (
    <main>
      <PageHead title={`${p.title} · ${p.version}`} crumbs="Cockpit › Protocols" sub={`${p.nace} · ${p.process} · ${p.service} · risk ${p.risk}`} actions={<><button className="btn">History</button><button className="btn primary">Propose v{Number(p.version.slice(1)) + 1}</button></>} />
      {!p.criteria ? <div className="card empty">Card details are filled for PR-01 in the demo.</div> : (
        <section className="grid g-2-1">
          <div className="stack">
            <div className="card"><h3>Measurable goal</h3><p>{p.goal}</p></div>
            <div className="card"><h3>Acceptance criteria</h3>
              <table className="table"><thead><tr><th>Criterion</th><th>Must</th><th>Weight</th><th>Check</th></tr></thead>
                <tbody>{p.criteria.map((c) => <tr key={c.t}><td>{c.t}</td><td>{c.must ? <span className="badge bad">must</span> : "—"}</td><td className="num">{c.weight}</td><td>{c.method}</td></tr>)}</tbody></table>
            </div>
          </div>
          <div className="stack">
            <div className="card"><h3>Inputs</h3><ul>{p.inputs!.map((x) => <li key={x}>{x}</li>)}</ul></div>
            <div className="card"><h3>Steps (guidance)</h3><ol>{p.steps!.map((x) => <li key={x}>{x}</li>)}</ol><p className="muted small">For freelancers, steps are advice only: the protocol sets what and how good, not how or when.</p></div>
            <div className="card"><h3>Fixed rules</h3><p className="small">White-label · GDPR · brand tone · AI disclosure</p><h3>Customer SLA</h3><p className="small">{p.sla}</p></div>
          </div>
        </section>
      )}
    </main>
  );
}
