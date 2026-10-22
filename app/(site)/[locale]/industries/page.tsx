import Link from "next/link";
import { copyFor } from "@/config/site-copy";
import { tx } from "@/config/tx";
import { hubs, pick } from "@/mock/site";

export default async function Industries({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = copyFor(locale);
  return (
    <main className="wrap-site section">
      <h1>{c.hubs.title}</h1>
      <p className="sub muted">{c.hubs.sub}</p>
      <div className="callout small" style={{ marginBottom: 20 }}>
        {tx(locale, "هر هاب = یک زیرشاخه استاندارد NACE در یک کشور. هاب فقط وقتی منتشر می‌شود که ایجنت انتخاب بازار آن را برگزیده و محتوای اولیه‌اش آماده باشد.", "Each hub = one standard NACE sub-industry in one country. A hub goes live only when market selection picks it and its seed content is ready.")}
      </div>
      <div className="table-wrap card">
        <table className="table">
          <thead><tr><th>{tx(locale, "هاب", "Hub")}</th><th>NACE</th><th>{tx(locale, "کشور", "Country")}</th><th>{c.hubs.companies}</th><th>{tx(locale, "بازار", "Market")}</th><th>{tx(locale, "استفاده از AI", "AI adoption")}</th><th /></tr></thead>
          <tbody>
            {hubs.map((h) => (
              <tr key={h.slug}>
                <td>{h.icon} <b>{pick(h.name, locale)}</b></td>
                <td className="ltr">{h.nace}</td>
                <td>{h.flag} {h.country}</td>
                <td className="num">{h.stats.companies.toLocaleString("en-US")}</td>
                <td className="num">{h.stats.marketSize}</td>
                <td className="num">{h.stats.aiAdoption}</td>
                <td>{h.live ? <Link className="btn sm primary" href={`/${locale}/hub/${h.slug}`}>{c.hubs.open}</Link> : <span className="badge warn">{c.hubs.soon}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
