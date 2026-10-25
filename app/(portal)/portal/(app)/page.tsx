import { fmtEur, portalCopy } from "@/config/portal-copy";
import { getDb } from "@/db";
import { requireCustomer } from "@/lib/portal-auth";
import { listThreads, pendingApprovals, results } from "@/server/portal";
import { ApprovalsCard } from "@/ui/portal/Cards";
import { PortalChat } from "@/ui/portal/PortalChat";

// Home = conversation (Javad 2026-10-25). A one-line results strip and anything waiting sit above it.
export default async function PortalHome() {
  const { user, org, lang } = await requireCustomer();
  const db = getDb();
  const t = portalCopy(lang);
  const [r, waiting, threads] = await Promise.all([results(db, org.id), pendingApprovals(db, org.id), listThreads(db, org.id, user.id)]);
  return (
    <main>
      <div className="row small" style={{ gap: 18, flexWrap: "wrap", marginBottom: 12 }}>
        <span>{t.card.month}: <b className="num">{fmtEur(r.month.eur, lang)}</b></span>
        <span className="muted">{t.card.fee}: <span className="num">{fmtEur(r.feeEur, lang)}</span></span>
        {r.roi !== null && <span className="muted">{t.card.roi}: <b className="num">{r.roi}×</b></span>}
        <span className="muted">{t.card.since}: <span className="num">{fmtEur(r.sinceStart.eur, lang)}</span></span>
      </div>
      {waiting.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="small" style={{ marginBottom: 6 }}><b>✋ {t.r.approvals.replace("{n}", String(waiting.length))}</b></div>
          <ApprovalsCard data={waiting.map((a) => ({ id: a.id, title: a.title, detail: a.detail, link: a.link }))} t={t} lang={lang} />
        </div>
      )}
      <PortalChat key={lang} kind="portal" t={t} lang={lang} name={user.name.split(" ")[0]} threads={threads.map((x) => ({ id: x.id, title: x.title }))} />
    </main>
  );
}
