import Link from "next/link";
import { notFound } from "next/navigation";
import { leads, persona } from "@/mock/cockpit";
import { PageHead } from "@/ui/Shell";

export default async function PersonaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = leads.find((l) => l.id === id);
  if (!lead) notFound();
  const p = { ...persona, company: lead.company, tier: lead.tier };
  return (
    <main>
      <PageHead title={p.company} crumbs="Cockpit › CRM" sub={`Persona tier T${p.tier} · build cost €${p.cost} · internal only, never public`} actions={<><button className="btn">Generate contract</button><button className="btn primary">Draft personal offer</button></>} />
      <section className="grid g3" style={{ marginBottom: 18 }}>
        <div className="card"><h3>Facts</h3><table className="table"><tbody>{p.facts.map(([k, v]) => <tr key={k}><td className="muted">{k}</td><td>{v}</td></tr>)}</tbody></table></div>
        <div className="card"><h3>Likely pains</h3><ul>{p.pains.map((x) => <li key={x}>{x}</li>)}</ul><h3>Personal path</h3><ol>{p.path.map((x) => <li key={x}>{x}</li>)}</ol></div>
        <div className="card"><h3>Signals</h3><div className="list">{p.signals.map(([d, s]) => <div key={s} className="item small"><b>{d}</b><div className="grow">{s}</div></div>)}</div></div>
      </section>
      <div className="callout small">🔒 {p.sources} <Link href="/de-de/company/glastec-nord">Public page (facts only)</Link></div>
    </main>
  );
}
