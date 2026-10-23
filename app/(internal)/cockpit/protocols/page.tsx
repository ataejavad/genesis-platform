import Link from "next/link";
import { protocols } from "@/mock/cockpit";
import { PageHead } from "@/ui/Shell";

export default function Protocols() {
  return (
    <main>
      <PageHead title="Protocol library" crumbs="Cockpit › Delivery" sub="Search by industry (NACE) × process (APQC) × service. New versions need your approval; risk tier decides who checks delivery." actions={<button className="btn primary">＋ Draft protocol</button>} />
      <div className="row" style={{ marginBottom: 14 }}><input placeholder="Search: e.g. glass quote, CRM, APQC 3.5" style={{ maxWidth: 380 }} /><select style={{ width: "auto" }}><option>All risk tiers</option><option>low · auto QA</option><option>medium · QA judge + sampling</option><option>high · Javad</option></select></div>
      <div className="card table-wrap">
        <table className="table"><thead><tr><th>ID</th><th>Protocol</th><th>Version</th><th>NACE</th><th>Process</th><th>Service</th><th>Risk</th><th>Used</th><th>Pass rate</th></tr></thead>
          <tbody>{protocols.map((p) => <tr key={p.id}><td className="small">{p.id}</td><td><Link href={`/cockpit/protocols/${p.id}`}><b>{p.title}</b></Link></td><td>{p.version}</td><td>{p.nace}</td><td className="small">{p.process}</td><td>{p.service}</td><td><span className={`badge ${p.risk === "high" ? "bad" : p.risk === "medium" ? "warn" : "gray"}`}>{p.risk}</span></td><td className="num">{p.used}</td><td className="num">{p.pass}%</td></tr>)}</tbody></table>
      </div>
    </main>
  );
}
