import { applications, partners } from "@/mock/cockpit";
import { PageHead } from "@/ui/Shell";

export default function Partners() {
  return (
    <main>
      <PageHead title="Partners" crumbs="Cockpit › Delivery" sub="Everyone who works for or through us: internal contributors, white-label suppliers, agents." />
      <div className="card table-wrap" style={{ marginBottom: 18 }}>
        <table className="table"><thead><tr><th>Code</th><th>Name</th><th>Kind</th><th>Role</th><th>Country</th><th>Tier</th><th>Score</th><th>Jobs</th><th>On time</th><th>First pass</th><th>Documents</th></tr></thead>
          <tbody>{partners.map((p) => <tr key={p.code}><td className="small">{p.code}</td><td><b>{p.name}</b></td><td>{p.kind}</td><td>{p.role}</td><td>{p.country}</td><td><span className="badge">{p.tier}</span></td><td className="num">{p.score || "—"}</td><td className="num">{p.jobs}</td><td className="num">{p.onTime}%</td><td className="num">{p.firstPass}%</td><td>{p.docs === "ok" ? <span className="badge ok">ok</span> : <span className="badge warn">{p.docs}</span>}</td></tr>)}</tbody></table>
      </div>
      <h2>Applications</h2>
      <div className="grid g3">{applications.map((a) => <div key={a.name} className="card stack"><div className="row"><b>{a.name}</b><span className="spacer" /><span className="badge ai">AI {a.ai}</span></div><div className="muted small">{a.kind} · {a.country} · {a.for}</div><p className="small">{a.note}</p><div className="row"><button className="btn sm ok">Trial task</button><button className="btn sm">Generate contract</button><button className="btn sm danger">Decline</button></div></div>)}</div>
    </main>
  );
}
