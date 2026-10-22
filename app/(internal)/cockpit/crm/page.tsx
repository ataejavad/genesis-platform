import Link from "next/link";
import { leads } from "@/mock/cockpit";
import { PageHead } from "@/ui/Shell";

const tiers = ["T0 Directory", "T1 Light", "T2 Full", "T3 Customer"];

export default function Crm() {
  return (
    <main>
      <PageHead title="CRM & personas" crumbs="Cockpit › Growth" sub="Personas are built in tiers; each tier opens on a signal, so spend goes where buying is likely (doc 15 §6ح)." />
      <section className="grid g4" style={{ marginBottom: 18 }}>
        {tiers.map((t, i) => <div key={t} className="card stat"><div className="label">{t}</div><div className="value num">{[9400, 31, 4, 1][i].toLocaleString("en-US")}</div><div className="delta muted">{["active hubs, public facts", "matches ICP", "engagement signal", "signed"][i]} · {["€0", "€0.03", "€0.5–1", "in fee"][i]}</div></div>)}
      </section>
      <div className="card table-wrap">
        <table className="table"><thead><tr><th>Company</th><th>Hub</th><th>Tier</th><th>Score</th><th>Stage</th><th>Signals</th><th>Next step</th></tr></thead>
          <tbody>{leads.map((l) => <tr key={l.id}><td><Link href={`/cockpit/crm/${l.id}`}><b>{l.company}</b></Link><div className="muted small">{l.city}</div></td><td>{l.hub}</td><td><span className="badge">T{l.tier}</span></td><td className="num">{l.score}</td><td>{l.stage}</td><td className="small">{l.signals.join(", ") || "—"}</td><td className="small">{l.next}</td></tr>)}</tbody></table>
      </div>
    </main>
  );
}
