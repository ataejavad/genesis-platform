import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { protocols } from "@/db/schema";
import { listProtocols } from "@/server/projects";
import { PageHead } from "@/ui/Shell";
import { ApproveVersion, DraftForm } from "../../projects/Forms";

export default async function Protocol({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const [exists] = await db.select({ id: protocols.id }).from(protocols).where(eq(protocols.id, id)).catch(() => []);
  if (!exists) notFound();
  const p = (await listProtocols(db)).find((x) => x.protocol.id === id)!;
  const base = p.drafts[0] ?? p.approved ?? p.versions[0];
  return (
    <main className="stack">
      <PageHead title={`${p.protocol.code} · ${p.protocol.title}`} crumbs="Cockpit › Protocols" sub={`${p.protocol.apqc ?? ""} · ${p.versions.length} version(s)`} />
      {p.versions.map((v) => (
        <div key={v.id} className="card stack">
          <div className="card-head"><h3>v{v.version}</h3><span className={`badge ${v.status === "approved" ? "ok" : v.status === "draft" ? "warn" : "gray"}`}>{v.status}</span>{v.status === "draft" && <ApproveVersion id={v.id} />}</div>
          <div className="small"><b>Goal:</b> {v.goal}</div>
          <div className="grid g2 small"><div><b>Inputs</b><ul>{v.inputs.map((x) => <li key={x}>{x}</li>)}</ul></div><div><b>Deliverables</b><ul>{v.deliverables.map((x) => <li key={x}>{x}</li>)}</ul></div></div>
          <div className="small"><b>Acceptance criteria</b><ul>{v.criteria.map((c) => <li key={c.text}>{c.mandatory ? <b>{c.text}</b> : c.text} <span className="muted">· {c.method}{c.mandatory ? "" : " · optional"}</span></li>)}</ul></div>
          <div className="small"><b>Fixed rules</b><ul>{v.rules.map((x) => <li key={x}>{x}</li>)}</ul></div>
          {v.guidance && <div className="small"><b>Advice (not instructions):</b> {v.guidance}</div>}
          <div className="muted small">{v.standardDays} standard days · {v.changeNote}{v.approvedAt ? ` · approved ${v.approvedAt.toISOString().slice(0, 10)}` : ""}</div>
        </div>
      ))}
      {p.failures.length > 0 && <div className="card"><h3>Failed in QA</h3><ul className="small">{p.failures.map((f) => <li key={f.criterion}>{f.criterion}: {f.n}×</li>)}</ul></div>}
      {base && <DraftForm protocol={p.protocol.id} v={base} />}
    </main>
  );
}
