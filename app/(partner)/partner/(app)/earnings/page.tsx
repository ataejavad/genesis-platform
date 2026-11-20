import { partnerCopy } from "@/config/partner-copy";
import { getDb } from "@/db";
import { requirePartner } from "@/lib/partner-auth";
import { earnings } from "@/server/partners";
import { EarningsCard } from "@/ui/partner/PartnerCards";
import { PageHead } from "@/ui/Shell";

export default async function PartnerEarnings() {
  const { partner, lang } = await requirePartner();
  const t = partnerCopy(lang);
  const e = await earnings(getDb(), partner.id);
  return (
    <main className="stack" style={{ maxWidth: 860 }}>
      <PageHead title={t.page.earnings.title} sub={t.page.earnings.sub} />
      <EarningsCard data={e} t={t} lang={lang} />
      {e.rows.length === 0 && <p className="muted">{t.page.earnings.none}</p>}
    </main>
  );
}
