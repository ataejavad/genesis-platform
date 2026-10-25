import { fmtEur, portalCopy } from "@/config/portal-copy";
import { getDb } from "@/db";
import { requireCustomer } from "@/lib/portal-auth";
import { listServices } from "@/server/portal";
import { PageHead } from "@/ui/Shell";

// Invoices and contracts arrive with step 8 (contract factory + finance); the fixed fees are real now.
export default async function PortalBilling() {
  const { org, lang } = await requireCustomer();
  const t = portalCopy(lang);
  const services = await listServices(getDb(), org.id, lang);
  const active = services.filter((s) => s.status === "active");
  return (
    <main className="stack" style={{ maxWidth: 760 }}>
      <PageHead title={t.page.billing.title} sub={t.page.billing.sub} />
      <div className="card list">
        {active.map((s) => <div className="item" key={s.id}><span>{s.icon}</span><div className="grow">{s.name}<div className="muted small">{s.plan} · {t.page.services.since.replace("{d}", s.since)}</div></div><b className="num">{fmtEur(s.monthlyEur, lang)} {t.card.perMonth}</b></div>)}
        <div className="item"><b className="grow">{t.page.billing.total}</b><b className="num">{fmtEur(active.reduce((a, s) => a + s.monthlyEur, 0), lang)} {t.card.perMonth}</b></div>
      </div>
      <p className="muted small">{t.page.billing.invoices}</p>
    </main>
  );
}
