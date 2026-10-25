import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { getPageFor, pageUrl } from "@/server/company-pages";
import { pageDocSchema } from "@/server/company-page-doc";
import { STAGES, planEnv, priority, prospectDetail } from "@/server/crm";
import { LEGAL_BASES } from "@/server/outreach-rules";
import { listPackages } from "@/server/projects";
import { conversation } from "@/server/whatsapp";
import { PageHead } from "@/ui/Shell";
import { basis, stage } from "../../outreach/actions";
import { WonForm } from "../WonForm";

export const dynamic = "force-dynamic";

/** One company: facts, its page and persona, contacts with their legal basis, every touch, every message. */
export default async function Company({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const d = await prospectDetail(db, id);
  if (!d) notFound();
  const { prospect: p, contacts, touches } = d;
  const [page, messages, packages] = await Promise.all([getPageFor(db, id), conversation(db, id), listPackages(db)]);
  const doc = page ? pageDocSchema.safeParse(page.doc).data : undefined;
  const pr = priority(p);
  return (
    <main>
      <PageHead title={p.name} crumbs="Cockpit › CRM" sub={`${p.industry} · ${p.country} · ${p.source} · stage ${p.stage.replace(/_/g, " ")} · tier ${pr.tier} (score ${pr.score})`}
        actions={<div className="row">{p.stage !== "won" && <WonForm prospect={p.id} packages={packages} />}<form action={stage} className="row" style={{ gap: 6 }}><input type="hidden" name="prospect" value={p.id} /><select name="stage" defaultValue={p.stage}>{STAGES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select><button className="btn">Set stage</button></form></div>} />

      <section className="grid g3" style={{ marginBottom: 18 }}>
        <div className="card">
          <h3>Company</h3>
          <table className="table"><tbody>
            {[["Website", p.website], ["Phone", p.phone], ["City", [p.city, p.region].filter(Boolean).join(", ")], ["NACE", p.nace], ["Staff", p.staff], ["Score", p.score], ["Registro check", p.rpoCheckedAt ? `${p.rpoCheckedAt.toISOString().slice(0, 10)} · ${p.rpoListed ? "listed" : "not listed"}` : "not checked"], ["Note", p.note]].map(([k, v]) => <tr key={String(k)}><td className="muted">{k}</td><td>{v ?? "—"}</td></tr>)}
          </tbody></table>
          <h4>Signals</h4>
          <pre className="small" style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(p.signals, null, 1)}</pre>
        </div>
        <div className="card">
          <h3>Contacts</h3>
          {contacts.map((c) => (
            <div key={c.id} className="item" style={{ display: "block", marginBottom: 10 }}>
              <b>{c.name ?? c.role ?? "—"}</b> <span className="muted small">{c.role} · {c.source}</span>
              <div className="small">{[c.email, c.phone].filter(Boolean).join(" · ")} {c.linkedinUrl && <a href={c.linkedinUrl} target="_blank" rel="noopener">LinkedIn ↗</a>}</div>
              <div className="small">{c.emailConsent ? <span className="badge ok">consent</span> : null} Legal basis: <b>{c.legalBasis ?? "none"}</b>{c.basisSource ? ` (${c.basisSource})` : ""}</div>
              <form action={basis} className="row" style={{ gap: 6, marginTop: 4 }}>
                <input type="hidden" name="contact" value={c.id} />
                <select name="basis" defaultValue={c.legalBasis ?? ""}><option value="">none</option>{LEGAL_BASES.map((b) => <option key={b} value={b}>{b.replace("_", " ")}</option>)}</select>
                <input name="source" placeholder="where it comes from" defaultValue={c.basisSource ?? ""} />
                <button className="btn sm">Save</button>
              </form>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Company page {page && <span className={`badge ${page.status === "live" ? "ok" : ""}`}>{page.status}</span>}</h3>
          {!page || !doc ? <p className="muted small">No page (inbound company).</p> : (
            <>
              <p className="small">{page.status === "live" ? <a href={pageUrl(planEnv().appUrl, page)} target="_blank" rel="noopener">{pageUrl(planEnv().appUrl, page)}</a> : "Goes live when you approve the sequence."}</p>
              <p className="small">Views: <b>{page.views}</b>{page.firstViewedAt ? ` · first ${page.firstViewedAt.toISOString().slice(0, 16).replace("T", " ")}` : ""} · built by {doc.by}</p>
              <p className="small">{doc.persona.summary}</p>
              <ul className="small">{doc.facts.map((f) => <li key={f.text}>{f.text} · <a href={f.source.url}>{f.source.name}</a></li>)}</ul>
            </>
          )}
        </div>
      </section>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3>Sequence</h3>
        <table className="table"><thead><tr><th>Step</th><th>Channel</th><th>Status</th><th>Due</th><th>Outcome / reason</th></tr></thead>
          <tbody>{touches.map((t) => <tr key={t.id}><td>{t.step}</td><td>{t.channel}</td><td>{t.status}</td><td className="small">{t.dueAt.toISOString().slice(0, 10)}</td><td className="small">{t.outcome ?? t.blockedReason ?? ""}</td></tr>)}</tbody></table>
      </div>

      {messages.length > 0 && (
        <div className="card">
          <h3>Messages</h3>
          <div className="list">{messages.map((m) => <div key={m.id} className={`msg ${m.direction === "in" ? "them" : "me"}`}><span className="muted small">{m.channel} · {m.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span><div>{m.body}</div></div>)}</div>
        </div>
      )}
      <p className="small"><Link href="/cockpit/crm">← CRM</Link></p>
    </main>
  );
}
