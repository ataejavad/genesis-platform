import Link from "next/link";
import { markets } from "@/mock/cockpit";
import { PageHead } from "@/ui/Shell";

const tone: Record<string, string> = { live: "ok", "seed ready": "warn", candidate: "", rejected: "gray" };

export default function Markets() {
  return (
    <main>
      <PageHead title="Markets & hubs" crumbs="Cockpit › Growth" sub="Genesis stage 0: the market-selection agent scores industry × country filters. A hub goes live only when picked and seeded." actions={<button className="btn primary">Run selection now</button>} />
      <div className="card table-wrap">
        <table className="table"><thead><tr><th>Filter</th><th>NACE</th><th>Demand</th><th>Competition</th><th>Access</th><th>Law</th><th>Margin</th><th>Total</th><th>Hub</th><th /></tr></thead>
          <tbody>{markets.map((m) => <tr key={m.filter}><td><b>{m.filter}</b></td><td>{m.nace}</td><td className="num">{m.demand}</td><td className="num">{m.competition}</td><td className="num">{m.access}</td><td className="num">{m.law}</td><td className="num">{m.margin}</td><td className="num"><b>{m.total}</b></td><td><span className={`badge ${tone[m.hub]}`}>{m.hub}</span></td><td>{m.hub === "seed ready" ? <button className="btn sm ok">Go live</button> : m.hub === "live" ? <Link className="btn sm" href="/de-de/hub/glass-de">Open</Link> : null}</td></tr>)}</tbody></table>
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>Weights and data sources live in the agent's prompt (Git). Going live is a hard approval.</p>
    </main>
  );
}
