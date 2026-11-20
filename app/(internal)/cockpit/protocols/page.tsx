import Link from "next/link";
import { getDb } from "@/db";
import { judgeAgreement, listProtocols } from "@/server/projects";
import { PageHead } from "@/ui/Shell";
import { ApproveVersion } from "../projects/Forms";

// Step 7: the protocol library. Every task is checked against one approved version; drafts wait for Javad.
export default async function Protocols() {
  const db = getDb();
  const [list, agree] = await Promise.all([listProtocols(db), judgeAgreement(db)]);
  const drafts = list.flatMap((p) => p.drafts.map((d) => ({ p: p.protocol, d })));
  return (
    <main className="stack">
      <PageHead title="Protocol library" crumbs="Cockpit › Delivery" sub="What and how well, never how or when (freelancers choose their method). Fixed rules in every protocol: white-label, GDPR, AI disclosure (AI Act art. 50)." />
      {drafts.length > 0 && (
        <div className="card">
          <h3>Drafts waiting for your approval ({drafts.length})</h3>
          <div className="list">{drafts.map(({ p, d }) => <div key={d.id} className="item"><div className="grow"><b>{p.code} v{d.version}</b> {p.title}<div className="muted small">{d.changeNote}</div></div><Link className="btn sm" href={`/cockpit/protocols/${p.id}`}>Read</Link><ApproveVersion id={d.id} /></div>)}</div>
        </div>
      )}
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Code</th><th>Protocol</th><th>Version in use</th><th>Process</th><th>Criteria</th><th>Std days</th><th>Failed most</th></tr></thead>
          <tbody>{list.map(({ protocol: p, approved: a, failures }) => <tr key={p.id}><td className="small">{p.code}</td><td><Link href={`/cockpit/protocols/${p.id}`}><b>{p.title}</b></Link></td><td>{a ? `v${a.version}` : <span className="badge bad">none approved</span>}</td><td className="small">{p.apqc}</td><td className="num">{a?.criteria.length ?? 0}</td><td className="num">{a?.standardDays ?? "–"}</td><td className="small">{failures[0] ? `${failures[0].criterion} (${failures[0].n}×)` : "–"}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="muted small">QA judge agreement with your decisions: {agree.agreement === null ? "no comparisons yet (the judge starts with the Claude key)" : `${Math.round(agree.agreement * 100)}% on ${agree.compared} deliveries (target 80%+ before it decides more alone)`}.</p>
    </main>
  );
}
