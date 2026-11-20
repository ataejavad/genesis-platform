import { partnerCopy } from "@/config/partner-copy";
import { getDb } from "@/db";
import { requirePartner } from "@/lib/partner-auth";
import { offerCards } from "@/server/partner-chat";
import { OfferCard } from "@/ui/partner/PartnerCards";
import { PageHead } from "@/ui/Shell";

export default async function PartnerOffers() {
  const { partner, lang } = await requirePartner();
  const t = partnerCopy(lang);
  const offers = await offerCards(getDb(), partner.id);
  return (
    <main className="stack" style={{ maxWidth: 860 }}>
      <PageHead title={t.page.offers.title} sub={t.page.offers.sub} />
      {offers.length ? offers.map((o) => <OfferCard key={o.id} o={o} t={t} lang={lang} />) : <p className="muted">{t.page.offers.none}</p>}
    </main>
  );
}
