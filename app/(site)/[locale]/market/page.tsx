import Link from "next/link";
import { copyFor } from "@/config/site-copy";
import { tx } from "@/config/tx";
import { LOCALES, isLocale } from "@/config/locales";
import { factsFor, liveIndustries, pick, productsFor } from "@/mock/site";
import { visitorCountries, visitorIndustry } from "@/ui/site/country";
import { CountrySwitch } from "@/ui/site/CountrySwitch";

// Industry-specific marketplace (doc 15 §6ه.5): no generic aisle, the visitor picks an industry first.
export default async function Market({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ industry?: string; country?: string }> }) {
  const { locale } = await params;
  const { industry, country } = await searchParams;
  const c = copyFor(locale);
  // Defaults: the visitor's saved industry, or the only live one.
  const current = liveIndustries.find((i) => i.slug === industry) ?? (await visitorIndustry()) ?? (liveIndustries.length === 1 ? liveIndustries[0] : undefined);
  const wanted = country ? [country.toUpperCase()] : await visitorCountries(locale);
  const facts = current && factsFor(current, wanted.find((cc) => current.countries.some((f) => f.country === cc)));
  const list = current && facts ? productsFor(current.slug, facts.country) : [];
  const q = (cc: string) => `?industry=${current?.slug}&country=${cc.toLowerCase()}`;
  return (
    <main className="wrap-site section">
      <h1>{c.market.title}</h1>
      <p className="muted">{c.market.sub}</p>
      <div className="row" style={{ margin: "16px 0 24px" }} role="group" aria-label={c.market.pick}>
        <b className="small">{c.market.pick}:</b>
        {liveIndustries.map((i) => (
          <Link key={i.slug} href={`/${locale}/market?industry=${i.slug}`} className="chip" aria-current={i.slug === current?.slug ? "true" : undefined} style={i.slug === current?.slug ? { borderColor: "var(--brand)", background: "var(--brand-soft)" } : undefined}>
            {i.icon} {pick(i.name, locale)}
          </Link>
        ))}
        <span className="spacer" />
        {current && facts && (
          <CountrySwitch
            lang={isLocale(locale) ? LOCALES[locale].lang : "en"}
            label={tx(locale, "کشور", "Country")}
            current={facts.country}
            options={current.countries.map((f) => ({ code: f.country, flag: f.flag, href: `/${locale}/market${q(f.country)}` }))}
          />
        )}
      </div>
      {!current && <div className="card empty">{c.market.pick} ↑</div>}
      {current && facts && (
        <div className="grid g2">
          {list.map((p) => (
            <Link key={p.slug} className="tile" href={`/${locale}/market/${p.slug}${q(facts!.country)}`}>
              <div className="row"><span className="ico">{p.icon}</span><div style={{ flex: 1 }}><b>{pick(p.name, locale)}</b><div className="muted small">{pick(p.kind, locale)} · <span className="ltr">{p.process}</span></div></div><span className="badge">★ {p.rating}</span></div>
              <div>{pick(p.outcome, locale)}</div>
              <div className="row small">
                <b>{c.market.from} €{p.plans[0].price}</b><span className="muted">{pick(p.plans[0].per, locale)}</span>
                <span className="spacer" />
                <span className="badge gray">⏱ {pick(p.setup, locale)}</span>
                <span className="badge ok">📐 {tx(locale, "پروتکل", "Protocol")} {p.protocol}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
      <p className="muted small" style={{ marginTop: 18 }}>
        {tx(locale, "برای ایجنت‌های خریدار: همین فهرست به‌صورت ماشین‌خوان در ", "For buyer agents: the same catalogue is machine-readable at ")}<a className="ltr" href="/api/v1/catalog">/api/v1/catalog</a>
      </p>
    </main>
  );
}
