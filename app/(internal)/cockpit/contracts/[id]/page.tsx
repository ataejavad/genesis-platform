import Link from "next/link";
import { notFound } from "next/navigation";
import { INDEPENDENCE_QUESTIONS } from "@/config/jurisdictions";
import { getDb } from "@/db";
import { contractMilestones, getContract } from "@/server/contracts";
import { ContractSummary, ContractText } from "@/ui/shared/ContractView";
import { PageHead } from "@/ui/Shell";

export default async function ContractDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const c = await getContract(db, id).catch(() => null);
  if (!c) notFound();
  const ms = await contractMilestones(db, c.orderId);
  const ev = c.evidence;
  return (
    <main className="stack">
      <PageHead title={c.title} crumbs="Cockpit › Contracts" sub={`${c.kind} · ${c.templateVersion} · ${c.language.toUpperCase()} · ${c.status}`} actions={<Link className="btn" href="/cockpit/contracts">All contracts</Link>} />
      {!c.reviewed && <div className="callout small">Template not reviewed by a lawyer yet. Fine for pilots; get the Italian pack reviewed once (≈ €500–1,500) before scaling.</div>}
      <div className="card"><h3>One-page summary</h3><ContractSummary c={c} labels={{ give: "We give", get: "They commit to", money: "Money", risks: "Risks" }} /></div>
      <section className="grid g2">
        <div className="card small stack">
          <h3>Signature evidence</h3>
          <div>Text hash (SHA-256): <code className="ltr">{ev?.hash.slice(0, 24)}…</code></div>
          <div>Signer: {c.signerName ?? "–"} {c.signerEmail && <span className="muted">· {c.signerEmail}</span>}</div>
          <div>Text signed: {ev?.signedAt ?? "–"}</div>
          {c.onerous.length > 0 && <div>Onerous clauses approved: {ev?.clausesAt ?? "–"} <span className="muted">({c.onerous.map((o) => o.title).join(", ")})</span></div>}
          <div className="muted">IP {ev?.ip ?? "–"} · {ev?.ua?.slice(0, 80) ?? "–"}</div>
          {ev?.answers && <div>Independence: {INDEPENDENCE_QUESTIONS.map((q) => <span key={q.id} className={`badge ${ev.answers![q.id] === false ? "warn" : "ok"}`} style={{ marginInlineEnd: 4 }}>{q.text.en}: {ev.answers![q.id] ? "yes" : "no"}</span>)}</div>}
          <div className="muted">Approved by {c.approvedBy ?? "–"}</div>
        </div>
        <div className="card small stack">
          <h3>Money</h3>
          {c.kind === "customer" ? <>
            <div>Set-up €{c.amountEur} · monthly €{c.monthlyEur} · deposit €{c.depositEur}</div>
            {ms.length > 0 && <ul style={{ margin: 0 }}>{ms.map((m) => <li key={m.id}>{m.title}: €{m.amountEur} · {m.status}</li>)}</ul>}
            {c.orgId && <Link href="/cockpit/finance">Invoices in Finance →</Link>}
          </> : <div>Paid per accepted job by level (Earnings).</div>}
        </div>
      </section>
      <details className="card"><summary><b>Full text</b></summary><ContractText body={c.body} lang={c.language} /></details>
    </main>
  );
}
