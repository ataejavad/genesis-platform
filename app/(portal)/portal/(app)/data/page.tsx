import { portalCopy } from "@/config/portal-copy";
import { requireCustomer } from "@/lib/portal-auth";
import { RequestButton } from "@/ui/portal/RequestForm";
import { PageHead } from "@/ui/Shell";

export default async function PortalData() {
  const { lang } = await requireCustomer();
  const t = portalCopy(lang);
  return (
    <main className="stack" style={{ maxWidth: 760 }}>
      <PageHead title={t.page.data.title} sub={t.page.data.sub} />
      <div className="card stack">
        <a className="btn primary" href="/portal/data/export" download>⬇ {t.page.data.export}</a>
        <RequestButton kind="data_delete" text={t.page.data.delText} label={t.page.data.del} done={t.page.data.delSent} />
      </div>
    </main>
  );
}
