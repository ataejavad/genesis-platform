import { portalCopy } from "@/config/portal-copy";
import { getDb } from "@/db";
import { requireCustomer } from "@/lib/portal-auth";
import { listRequests } from "@/server/portal";
import { RequestsCard } from "@/ui/portal/Cards";
import { RequestForm } from "@/ui/portal/RequestForm";
import { PageHead } from "@/ui/Shell";

export default async function PortalRequests() {
  const { org, lang } = await requireCustomer();
  const t = portalCopy(lang);
  const rows = await listRequests(getDb(), org.id);
  return (
    <main className="stack" style={{ maxWidth: 900 }}>
      <PageHead title={t.page.requests.title} sub={t.page.requests.sub} />
      <RequestForm t={t} kinds={["solution", "change", "support", "upgrade"]} />
      {rows.length ? <RequestsCard data={rows.map((x) => ({ id: x.id, kind: x.kind, text: x.text, status: x.status, reply: x.reply, createdAt: x.createdAt.toISOString().slice(0, 10) }))} t={t} lang={lang} /> : <p className="muted">{t.r.requestsNone}</p>}
    </main>
  );
}
