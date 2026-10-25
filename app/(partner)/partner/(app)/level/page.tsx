import { partnerCopy } from "@/config/partner-copy";
import { getDb } from "@/db";
import { requirePartner } from "@/lib/partner-auth";
import { TIERS } from "@/server/partner-rules";
import { levelFor } from "@/server/partners";
import { LevelCard } from "@/ui/partner/PartnerCards";
import { PageHead } from "@/ui/Shell";

export default async function PartnerLevel() {
  const { partner, lang } = await requirePartner();
  const t = partnerCopy(lang);
  const p = t.page.level;
  const l = await levelFor(getDb(), partner.id);
  return (
    <main className="stack" style={{ maxWidth: 860 }}>
      <PageHead title={p.title} sub={p.sub} />
      <LevelCard data={l} t={t} lang={lang} />
      <div className="card table-wrap">
        <h3>{p.rules}</h3>
        <table>
          <thead><tr><th>{t.nav.level}</th><th>{p.accepted}</th><th>{p.quality}</th><th>{p.onTime}</th><th>{t.nav.earnings}</th></tr></thead>
          <tbody>{TIERS.map((x) => <tr key={x.id} style={x.id === l.tier.id ? { fontWeight: 700 } : undefined}><td>{t.tiers[x.id]}</td><td>{x.min.accepted}+</td><td>{x.min.quality ? `${x.min.quality}+` : "–"}</td><td>{x.min.onTime ? `${Math.round(x.min.onTime * 100)}%+` : "–"}</td><td>{t.card.perDays.replace("{d}", String(x.payoutDays))}</td></tr>)}</tbody>
        </table>
      </div>
    </main>
  );
}
