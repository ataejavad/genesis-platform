import { moneyCopy } from "@/config/money-copy";
import { fmtEur, portalCopy } from "@/config/portal-copy";
import { getDb } from "@/db";
import { requireCustomer } from "@/lib/portal-auth";
import { contractsFor } from "@/server/contracts";
import { epcPayload, getCompany, invoicesFor, qrSvg } from "@/server/finance";
import { listServices } from "@/server/portal";
import { PageHead } from "@/ui/Shell";

const money = (n: number, lang: string) => new Intl.NumberFormat({ it: "it-IT", de: "de-DE", fa: "fa-IR" }[lang] ?? "en-GB", { style: "currency", currency: "EUR" }).format(n);

const VAT: Record<string, string> = { it: "IVA", de: "MwSt.", en: "VAT", fa: "مالیات" };

// Contract & billing: what to pay now (bank transfer with QR code), the fixed fees, invoices and contracts.
export default async function PortalBilling() {
  const { org, lang } = await requireCustomer();
  const db = getDb();
  const t = portalCopy(lang);
  const m = moneyCopy(lang);
  const [services, invoices, contracts, co] = await Promise.all([listServices(db, org.id, lang), invoicesFor(db, org.id), contractsFor(db, { orgId: org.id }), getCompany(db)]);
  const active = services.filter((s) => s.status === "active");
  const open = invoices.filter((i) => i.status === "requested");
  const qr = await Promise.all(open.map(async (i) => {
    const p = co ? epcPayload(co, i) : null;
    return p ? qrSvg(p) : null;
  }));
  const day = (d: Date) => d.toLocaleDateString(lang);
  return (
    <main className="stack" style={{ maxWidth: 860 }}>
      <PageHead title={t.page.billing.title} sub={t.page.billing.sub} />
      <h3 style={{ margin: 0 }}>{m.billing.open}</h3>
      {open.length === 0 && <p className="muted small" style={{ margin: 0 }}>{m.billing.none}</p>}
      {open.map((i, k) => (
        <div className="card row" key={i.id} style={{ alignItems: "flex-start", gap: 20 }}>
          <div className="stack grow" style={{ flex: 1, minWidth: 240 }}>
            <b>{m.billing.kinds[i.kind] ?? i.kind}: {i.title}</b>
            <div className="small">{m.billing.amount}: <b className="num">{money(i.totalEur, lang)}</b>{i.vatEur > 0 && <span className="muted"> ({money(i.netEur, lang)} + {VAT[lang] ?? "VAT"} {i.vatRate}%)</span>}</div>
            {i.vatNote && <div className="small muted">{i.vatNote}</div>}
            <div className="small">{m.billing.due}: {day(i.dueAt)}</div>
            {co?.iban ? (
              <div className="small stack" style={{ gap: 2 }}>
                <span>{m.billing.holder}: <b>{co.legalName}</b></span>
                <span>IBAN: <b className="ltr">{co.iban.replace(/(.{4})/g, "$1 ").trim()}</b>{co.bic && <> · BIC <span className="ltr">{co.bic}</span></>}</span>
                <span>{m.billing.reference}: <b className="ltr">{i.reference}</b></span>
              </div>
            ) : <div className="small muted">{m.billing.noIban} {m.billing.reference}: <b className="ltr">{i.reference}</b></div>}
          </div>
          {qr[k] && <figure style={{ margin: 0, width: 150, textAlign: "center" }}><div style={{ width: 150, background: "#fff", padding: 4, borderRadius: 8 }} dangerouslySetInnerHTML={{ __html: qr[k]! }} /><figcaption className="muted" style={{ fontSize: 11.5 }}>{m.billing.scan}</figcaption></figure>}
        </div>
      ))}
      {active.length > 0 && <div className="card list">
        {active.map((s) => <div className="item" key={s.id}><span>{s.icon}</span><div className="grow">{s.name}<div className="muted small">{s.plan} · {t.page.services.since.replace("{d}", s.since)}</div></div><b className="num">{fmtEur(s.monthlyEur, lang)} {t.card.perMonth}</b></div>)}
        <div className="item"><b className="grow">{t.page.billing.total}</b><b className="num">{fmtEur(active.reduce((a, s) => a + s.monthlyEur, 0), lang)} {t.card.perMonth}</b></div>
      </div>}
      {invoices.some((i) => i.status !== "requested") && (
        <div className="card list">
          <h3>{m.billing.history}</h3>
          {invoices.filter((i) => i.status !== "requested").map((i) => (
            <div className="item small" key={i.id}><div className="grow">{m.billing.kinds[i.kind] ?? i.kind}: {i.title}<div className="muted">{day(i.paidAt ?? i.createdAt)}</div></div><b className="num">{money(i.totalEur, lang)}</b><span className={`badge ${i.status === "cancelled" ? "gray" : "ok"}`}>{(m.billing.status[i.status] ?? i.status).replace("{n}", i.number ?? "")}</span></div>
          ))}
        </div>
      )}
      {contracts.length > 0 && (
        <div className="card list">
          <h3>{m.billing.contracts}</h3>
          {contracts.filter((c) => c.status !== "cancelled").map((c) => (
            <div className="item small" key={c.id}><div className="grow">{c.title}<div className="muted">{c.status === "signed" ? m.billing.signedOn.replace("{date}", day(c.signedAt!)) : m.billing.toSign}</div></div><a className={`btn sm ${c.status === "sent" ? "primary" : ""}`} href={`/portal/contract/${c.id}`}>{m.billing.open_contract}</a></div>
          ))}
        </div>
      )}
    </main>
  );
}
