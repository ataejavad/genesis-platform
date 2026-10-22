import { moderation } from "@/mock/cockpit";
import { PageHead } from "@/ui/Shell";

export default function Moderation() {
  return (
    <main>
      <PageHead title="Moderation" crumbs="Cockpit › Delivery" sub="Mediated messaging masks contact details (anti-bypass); member posts in hubs wait for approval (DSA)." />
      <div className="card table-wrap"><table className="table"><thead><tr><th>Where</th><th>Original</th><th>Delivered</th><th>Reason</th><th>State</th><th /></tr></thead>
        <tbody>{moderation.map((m) => <tr key={m.original}><td className="small">{m.where}</td><td className="small">{m.original}</td><td className="small">{m.delivered}</td><td>{m.reason}</td><td><span className="badge warn">{m.state}</span></td><td><div className="row"><button className="btn sm ok">Release</button><button className="btn sm danger">Block</button></div></td></tr>)}</tbody></table></div>
    </main>
  );
}
