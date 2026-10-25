import { moneyCopy } from "@/config/money-copy";
import { fmtEur, portalCopy } from "@/config/portal-copy";
import { getDb } from "@/db";
import { requireCustomer } from "@/lib/portal-auth";
import { contractsFor } from "@/server/contracts";
import { invoicesFor } from "@/server/finance";
import { listThreads, pendingApprovals, results } from "@/server/portal";
import { ApprovalsCard } from "@/ui/portal/Cards";
import { PortalChat } from "@/ui/portal/PortalChat";

// Home = conversation (Javad 2026-10-25). A one-line results strip and anything waiting sit above it.
export default async function PortalHome() {
  const { user, org, lang } = await requireCustomer();
  const db = getDb();
  const t = portalCopy(lang);
  const [r, waiting, threads, contracts, invoices] = await Promise.all([results(db, org.id), pendingApprovals(db, org.id), listThreads(db, org.id, user.id), contractsFor(db, { orgId: org.id }), invoicesFor(db, org.id)]);
  const m = moneyCopy(lang);
  // contract to sign and money to pay come first: nothing starts without them (step 8)
  const todo = [
    ...contracts.filter((c) => c.status === "sent").map((c) => ({ href: `/portal/contract/${c.id}`, text: m.signContract.replace("{title}", c.title) })),
    ...invoices.filter((i) => i.status === "requested").map((i) => ({ href: "/portal/billing", text: m.payRequest.replace("{amount}", fmtEur(i.totalEur, lang)).replace("{due}", i.dueAt.toLocaleDateString(lang)) })),
  ];
  return (
    <main>
      <div className="row small" style={{ gap: 18, flexWrap: "wrap", marginBottom: 12 }}>
        <span>{t.card.month}: <b className="num">{fmtEur(r.month.eur, lang)}</b></span>
        <span className="muted">{t.card.fee}: <span className="num">{fmtEur(r.feeEur, lang)}</span></span>
        {r.roi !== null && <span className="muted">{t.card.roi}: <b className="num">{r.roi}×</b></span>}
        <span className="muted">{t.card.since}: <span className="num">{fmtEur(r.sinceStart.eur, lang)}</span></span>
      </div>
      {todo.length > 0 && (
        <div className="card today">
          <b className="small">📌 {m.toDo}</b>
          <ul className="today-list small">{todo.map((x) => <li key={x.href + x.text}><a href={x.href}>{x.text}</a></li>)}</ul>
        </div>
      )}
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
