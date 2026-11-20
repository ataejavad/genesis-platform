import { partnerCopy } from "@/config/partner-copy";
import { getDb } from "@/db";
import { requirePartner } from "@/lib/partner-auth";
import { todayFor } from "@/server/partners";
import { listThreads } from "@/server/portal";
import { TodayList } from "@/ui/partner/PartnerCards";
import { PortalChat } from "@/ui/portal/PortalChat";

// Home = today's priorities on top, then the conversation that answers everything else (Javad 2026-10-25).
export default async function PartnerHome() {
  const { user, partner, lang } = await requirePartner();
  const db = getDb();
  const t = partnerCopy(lang);
  const [today, threads] = await Promise.all([todayFor(db, partner.id), partner.orgId ? listThreads(db, partner.orgId, user.id) : []]);
  const dateFmt = new Intl.DateTimeFormat(lang === "fa" ? "fa-IR" : lang, { weekday: "long", day: "numeric", month: "long" });
  return (
    <main>
      <section className="card today" aria-labelledby="today-h">
        <h2 id="today-h">☀️ {t.today.title} <span className="muted small" style={{ fontWeight: 400 }}>{dateFmt.format(new Date())}</span></h2>
        {today.length ? <TodayList items={today.slice(0, 6)} t={t} lang={lang} /> : <p className="muted small" style={{ margin: 0 }}>{t.today.empty}</p>}
      </section>
      <PortalChat key={lang} kind="partner" t={t} lang={lang} name={partner.name.split(" ")[0]} threads={threads.map((x) => ({ id: x.id, title: x.title }))} />
    </main>
  );
}
