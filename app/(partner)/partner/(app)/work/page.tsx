import { partnerCopy } from "@/config/partner-copy";
import { fmtEur } from "@/config/portal-copy";
import { getDb } from "@/db";
import { requirePartner } from "@/lib/partner-auth";
import { workFor } from "@/server/partners";
import { DeliverForm } from "@/ui/partner/DeliverForm";
import { PageHead } from "@/ui/Shell";

export default async function PartnerWork() {
  const { partner, lang } = await requirePartner();
  const t = partnerCopy(lang);
  const p = t.page.work;
  const rows = await workFor(getDb(), partner.id);
  return (
    <main className="stack" style={{ maxWidth: 860 }}>
      <PageHead title={p.title} sub={p.sub} />
      {rows.length === 0 && <p className="muted">{p.none}</p>}
      {rows.map(({ job, last, materials }) => (
        <div className="card stack" key={job.id}>
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
            <b>{job.title}</b><span className="badge">{job.kind === "customer" ? `${t.card.customer} ${job.customerCode ?? ""}` : t.card.internal}</span>
            <span className="spacer" /><span className="badge">{t.status[job.status] ?? job.status}</span>
          </div>
          <div className="row small" style={{ gap: 16 }}><span>{t.card.pay}: <b className="num">{fmtEur(job.payEur, lang)}</b></span><span>{t.card.due}: <b>{job.dueAt.toISOString().slice(0, 10)}</b></span></div>
          <details open={job.status === "assigned"}><summary className="small">{p.brief}</summary><p className="small" style={{ whiteSpace: "pre-wrap" }}>{job.brief}</p></details>
          {materials.length > 0 && (
            <details open={job.status === "assigned"}>
              <summary className="small">{p.materials} ({materials.length})</summary>
              <ul className="small">
                {materials.map((m) => <li key={m.id}><b>{m.label}</b>{m.text && <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>}{m.file && <a href={m.file.url} target="_blank" rel="noopener">{p.file}: {m.file.name}</a>}</li>)}
              </ul>
            </details>
          )}
          {last && (
            <div className="callout small">
              {p.version.replace("{v}", String(last.version))} · <a href={last.link} target="_blank" rel="noopener">{last.link}</a> · {t.status[last.status] ?? last.status}
              {last.review && <div><b>{p.review}:</b> {last.review}</div>}
            </div>
          )}
          {job.status === "assigned" && <DeliverForm jobId={job.id} checklist={job.checklist} t={t} qa={job.role === "qa"} />}
        </div>
      ))}
    </main>
  );
}
