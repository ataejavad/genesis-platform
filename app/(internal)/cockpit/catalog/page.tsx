import { getDb } from "@/db";
import { listPackages, listProtocols } from "@/server/projects";
import { PageHead } from "@/ui/Shell";

const eur = (n: number) => `€${n.toLocaleString("en-GB")}`;

// The catalogue: what we sell = protocols + tasks + milestones + price. No package, no sale (doc 15 §6د).
export default async function Catalog() {
  const db = getDb();
  const [packages, protocols] = await Promise.all([listPackages(db, true), listProtocols(db)]);
  const approved = new Set(protocols.filter((p) => p.approved).map((p) => p.protocol.code));
  return (
    <main className="stack">
      <PageHead title="Catalogue" crumbs="Cockpit › Growth" sub="Every package = protocols + task template + milestones + setup price + monthly fee. Agents read it at /api/v1/catalog." />
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>Package</th><th>Tasks (protocol)</th><th>Milestones</th><th>Setup</th><th>Monthly</th><th>Partner cost</th><th>Margin</th><th>Status</th></tr></thead>
          <tbody>{packages.map((p) => {
            const cost = p.tasks.reduce((s, t) => s + t.payEur, 0);
            const missing = p.tasks.filter((t) => !approved.has(t.protocol));
            return (
              <tr key={p.slug}>
                <td><b>{p.title}</b><div className="muted small">{p.slug}</div></td>
                <td className="small">{p.tasks.map((t) => <div key={t.title}>{t.title} <span className="muted">({t.protocol}, {t.days}d, {eur(t.payEur)})</span></div>)}</td>
                <td className="small">{p.milestones.map((m) => `${m.title} ${m.sharePct}%`).join(" · ")}</td>
                <td className="num">{eur(p.setupEur)}</td><td className="num">{eur(p.monthlyEur)}</td><td className="num">{eur(cost)}</td>
                <td className="num">{Math.round(((p.setupEur - cost) / p.setupEur) * 100)}%</td>
                <td>{missing.length ? <span className="badge bad">protocol missing</span> : p.active ? <span className="badge ok">live</span> : <span className="badge gray">off</span>}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </main>
  );
}
