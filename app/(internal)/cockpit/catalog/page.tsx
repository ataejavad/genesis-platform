import { catalog } from "@/mock/cockpit";
import { PageHead } from "@/ui/Shell";

export default function Catalog() {
  return (
    <main>
      <PageHead title="Marketplace catalogue" crumbs="Cockpit › Growth" sub="Rule: nothing is sold without a protocol, and no third-party tool without a resale/white-label licence check and a DPA." actions={<button className="btn primary">＋ Propose product</button>} />
      <div className="card table-wrap">
        <table className="table"><thead><tr><th>Product</th><th>Listed in hubs</th><th>Process</th><th>Protocol</th><th>Licence / DPA</th><th>Price</th><th>Status</th></tr></thead>
          <tbody>{catalog.map((c) => <tr key={c.name}><td><b>{c.name}</b></td><td className="small">{c.hubs}</td><td>{c.process}</td><td>{c.protocol === "missing" ? <span className="badge bad">missing</span> : c.protocol}</td><td className="small">{c.license}</td><td>{c.price}</td><td><span className={`badge ${c.status === "live" ? "ok" : "bad"}`}>{c.status}</span></td></tr>)}</tbody></table>
      </div>
    </main>
  );
}
