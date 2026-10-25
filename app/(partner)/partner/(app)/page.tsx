import { partnerCopy } from "@/config/partner-copy";
import { getDb } from "@/db";
import { requirePartner } from "@/lib/partner-auth";
import { offerCards } from "@/server/partner-chat";
import { listThreads } from "@/server/portal";
import { OfferCard } from "@/ui/partner/PartnerCards";
import { PortalChat } from "@/ui/portal/PortalChat";

// Home = conversation; new offers sit above it so nothing waits unseen.
export default async function PartnerHome() {
  const { user, partner, lang } = await requirePartner();
  const db = getDb();
  const t = partnerCopy(lang);
  const [offers, threads] = await Promise.all([offerCards(db, partner.id), partner.orgId ? listThreads(db, partner.orgId, user.id) : []]);
  return (
    <main>
      {offers.length > 0 && (
        <div className="stack" style={{ marginBottom: 14 }}>
          <div className="small"><b>📥 {t.r.offers.replace("{n}", String(offers.length))}</b></div>
          {offers.slice(0, 2).map((o) => <OfferCard key={o.id} o={o} t={t} lang={lang} />)}
        </div>
      )}
      <PortalChat key={lang} kind="partner" t={t} lang={lang} name={partner.name.split(" ")[0]} threads={threads.map((x) => ({ id: x.id, title: x.title }))} />
    </main>
  );
}
