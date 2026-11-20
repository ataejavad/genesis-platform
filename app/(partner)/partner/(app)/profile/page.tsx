import { moneyCopy } from "@/config/money-copy";
import { partnerCopy } from "@/config/partner-copy";
import { getDb } from "@/db";
import { requirePartner } from "@/lib/partner-auth";
import { skillLabel } from "@/server/partner-rules";
import { DOC_KINDS, documentsFor } from "@/server/partners";
import { saveDocument } from "@/ui/partner/actions";
import { IbanForm } from "@/ui/partner/IbanForm";
import { PageHead } from "@/ui/Shell";

export default async function PartnerProfile() {
  const { partner, lang } = await requirePartner();
  const t = partnerCopy(lang);
  const p = t.page.profile;
  const docs = await documentsFor(getDb(), partner.id);
  return (
    <main className="stack" style={{ maxWidth: 860 }}>
      <PageHead title={p.title} sub={p.sub} />
      <div className="card small stack">
        <div><b>{partner.name}</b> · <span className="ltr">{partner.email}</span></div>
        <div>{p.country}: {partner.country} · {p.languages}: {partner.languages.join(", ") || "–"}</div>
        <div>{p.skills}: {partner.skills.map((s) => skillLabel(s, lang)).join(", ")}</div>
      </div>
      <IbanForm t={moneyCopy(lang).iban} iban={partner.iban} name={partner.billingName ?? partner.name} />
      <div className="card list">
        {docs.map((d) => (
          <div className="item small" key={d.id}>
            <div className="grow"><b>{p.kinds[d.kind] ?? d.kind}</b> · <a href={d.link} target="_blank" rel="noopener">{d.link.slice(0, 60)}</a>{d.expiresAt && <span className="muted"> · {d.expiresAt.toISOString().slice(0, 10)}</span>}</div>
            {d.expiring && <span className="badge warn">{p.expiring}</span>}
            <span className={`badge ${d.status === "ok" ? "ok" : d.status === "rejected" ? "warn" : ""}`}>{p.docStatus[d.status] ?? d.status}</span>
          </div>
        ))}
      </div>
      <form action={saveDocument} className="card stack">
        <h3>{p.add}</h3>
        <div className="grid g3">
          <label className="field">{p.kind}<select name="kind">{DOC_KINDS.map((k) => <option key={k} value={k}>{p.kinds[k]}</option>)}</select></label>
          <label className="field">{p.link}<input name="link" type="url" required dir="ltr" placeholder="https://" /></label>
          <label className="field">{p.expires}<input name="expires" type="date" /></label>
        </div>
        <button className="btn primary">{p.add}</button>
      </form>
    </main>
  );
}
