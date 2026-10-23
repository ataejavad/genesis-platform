import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getDb } from "@/db";
import { LOCALES, isLocale } from "@/config/locales";
import { copyFor } from "@/config/site-copy";
import { tx } from "@/config/tx";
import { companies, factsFor, hubKey, industries, news, pick, posts, productsFor, tenders } from "@/mock/site";
import { BRAND } from "@/mock/data";
import { getHubDoc } from "@/server/hubs";
import { visitorCountries } from "@/ui/site/country";
import { HubView } from "@/ui/site/HubView";
import { CountrySwitch } from "@/ui/site/CountrySwitch";
import { RememberIndustry } from "@/ui/site/Remember";
import { ActionButton, Newsletter } from "@/ui/site/SiteClient";

type Props = { params: Promise<{ locale: string; slug: string; country?: string[] }> };

// /hub/glass/de is the crawlable page for one country; /hub/glass shows the same hub for this visitor's country.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug, country } = await params;
  const industry = industries.find((i) => i.slug === slug);
  if (!industry) return {};
  const cc = factsFor(industry, country?.[0] ?? industry.countries[0].country).country;
  const hub = industry.live ? await getHubDoc(getDb(), locale, slug, cc).catch(() => null) : null;
  return {
    title: hub?.doc.name ?? pick(industry.name, locale),
    description: hub?.doc.tagline,
    alternates: { canonical: `/${locale}/hub/${slug}/${cc.toLowerCase()}` },
  };
}

// One hub per industry (doc 15 §6ه.2); the country is a filter inside it, so visitors never pick from industry × country lists.
export default async function Hub({ params }: Props) {
  const { locale, slug, country } = await params;
  const industry = industries.find((i) => i.slug === slug);
  if (!industry) {
    // Old industry × country links (glass-de) keep working.
    const [old, cc] = slug.split("-");
    if (cc && industries.some((i) => i.slug === old)) permanentRedirect(`/${locale}/hub/${old}/${cc}`);
    notFound();
  }
  if (country && (country.length > 1 || !industry.countries.some((f) => f.country === country[0].toUpperCase()))) notFound();
  const wanted = country ? [country[0].toUpperCase()] : await visitorCountries(locale);
  const hub = factsFor(industry, wanted.find((cc) => industry.countries.some((f) => f.country === cc)));
  const key = hubKey(industry.slug, hub.country);
  const c = copyFor(locale);
  const t = (fa: string, en: string) => tx(locale, fa, en);
  const hubProducts = productsFor(industry.slug, hub.country);
  const lang = isLocale(locale) ? LOCALES[locale].lang : "en";
  const countrySwitch = (
    <CountrySwitch
      lang={lang}
      label={t("کشور", "Country")}
      current={hub.country}
      options={industry.countries.map((f) => ({ code: f.country, flag: f.flag, href: `/${locale}/hub/${industry.slug}/${f.country.toLowerCase()}` }))}
    />
  );
  const crumbs = <div className="crumbs"><Link href={`/${locale}/explore`}>{c.nav.explore}</Link> › <span className="ltr">NACE {industry.nace}</span></div>;
  // Live hubs show the approved hub-builder page; the sample layout below is only the fallback until then.
  const approved = industry.live ? await getHubDoc(getDb(), locale, industry.slug, hub.country).catch(() => null) : null;
  if (approved) {
    return (
      <main className="wrap-site section">
        <RememberIndustry slug={industry.slug} />
        {crumbs}
        <HubView doc={approved.doc} c={c} locale={locale} brand={BRAND} country={countrySwitch} />
      </main>
    );
  }
  return (
    <main className="wrap-site section">
      {industry.live && <RememberIndustry slug={industry.slug} />}
      {crumbs}
      {industry.live && <div className="card" role="status" style={{ marginBottom: 16, borderColor: "var(--warn)" }}>⏳ {c.hub.pending}</div>}
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1>{industry.icon} {pick(industry.name, locale)}</h1>
          <p className="muted" style={{ maxWidth: 720 }}>{pick(hub.overview, locale)}</p>
        </div>
        {countrySwitch}
        {!industry.live && <span className="badge warn">{t("پیش‌نمایش: هنوز منتشر نشده", "Preview: not published yet")}</span>}
      </div>
      <nav className="tabs" aria-label="hub">
        {[["#overview", t("نمای صنعت", "Overview")], ["#news", t("خبر و نوآوری", "News & innovation")], ["#solutions", c.nav.market], ["#directory", t("دایرکتوری شرکت‌ها", "Company directory")], ["#community", t("پست اعضا", "Member posts")], ["#tenders", t("مناقصه و رویداد", "Tenders & events")]].map(([h, l], i) => (
          <a key={h} href={h} className={i === 0 ? "active" : ""}>{l}</a>
        ))}
      </nav>

      <section id="overview" className="grid g4" style={{ marginBottom: 20 }}>
        <div className="card stat"><div className="label">{c.hubs.companies}</div><div className="value num">{hub.stats.companies.toLocaleString("en-US")}</div></div>
        <div className="card stat"><div className="label">{t("کارکنان", "Employees")}</div><div className="value num">{hub.stats.employees}</div></div>
        <div className="card stat"><div className="label">{t("اندازه بازار", "Market size")}</div><div className="value num">{hub.stats.marketSize}</div></div>
        <div className="card stat"><div className="label">{t("استفاده از AI", "AI adoption")}</div><div className="value num">{hub.stats.aiAdoption}</div><div className="delta muted">Eurostat 2025</div></div>
      </section>
      <p className="muted small" style={{ marginTop: -12, marginBottom: 20 }}>{t("منبع", "Source")}: {hub.sources.stats} · {t("به‌روزرسانی", "updated")} {hub.sources.updated} · ✓ {t("با دو منبع تطبیق داده شد", "cross-checked in 2 sources")}</p>
      <div className="grid g2" style={{ marginBottom: 20 }}>
        <div className="card"><h3>{t("دردهای رایج این صنف", "Typical pains in this trade")}</h3><ul>{hub.pains.map((p) => <li key={p.en}>{pick(p, locale)}</li>)}</ul></div>
        <div className="card"><h3>{t("قوانین مهم", "Key rules")}</h3><p>{pick(hub.law, locale)}</p><p className="muted small">{t("منبع", "Source")}: {hub.sources.law} · {t("به‌روزرسانی", "updated")} {hub.sources.lawUpdated} · {t("ایجنت هاب‌ساز به‌روز نگه می‌دارد، با تأیید.", "Kept current by the hub-builder agent, with approval.")}</p></div>
      </div>

      <section id="news" className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><h3>📰 {t("خبر و نوآوری امروز", "Today's news & innovation")}</h3><span className="more muted">{t("هر روز ۶:۰۰ به‌روز می‌شود", "Updated daily 06:00")}</span></div>
        <div className="list">
          {news.filter((n) => n.hub === key).map((n) => (
            <div key={n.t.en} className="item"><div className="grow"><b>{pick(n.t, locale)}</b><div className="muted small">{n.src} · {n.date}</div></div><span className="badge ai">✦ {pick(n.ai, locale)}</span></div>
          ))}
        </div>
      </section>

      <section id="solutions" style={{ marginBottom: 20 }}>
        <h2>{c.market.title}</h2>
        <p className="muted small">{t("بیشتر راه‌حل‌ها در همه کشورها یکسان‌اند؛ چند مورد مخصوص همین کشور است.", "Most solutions work in every country; a few are made for this one.")}</p>
        <div className="grid g3">
          {hubProducts.map((p) => (
            <Link key={p.slug} className="tile" href={`/${locale}/market/${p.slug}?industry=${industry.slug}&country=${hub.country.toLowerCase()}`}>
              <div className="row"><span className="ico">{p.icon}</span><div><b>{pick(p.name, locale)}</b><div className="muted small">{pick(p.kind, locale)} · ★ {p.rating} ({p.reviews})</div></div></div>
              <div className="small">{pick(p.outcome, locale)}</div>
              <div className="small"><b>{c.market.from} €{p.plans[0].price}</b>{c.market.per}</div>
            </Link>
          ))}
        </div>
      </section>

      <section id="directory" className="card" style={{ marginBottom: 20 }}>
        <h3>🏢 {t("دایرکتوری شرکت‌ها", "Company directory")}</h3>
        <div className="list">
          {companies.filter((co) => co.hub === key).map((co) => (
            <div key={co.slug} className="item">
              <div className="grow"><Link href={`/${locale}/company/${co.slug}`}><b>{co.name}</b></Link><div className="muted small">{co.city} · {co.size} {t("نفر", "staff")} · {pick(co.services, locale)}</div></div>
              {co.claimed ? <span className="badge ok">✓ {t("تأییدشده", "Verified")}</span> : <span className="badge gray">{t("ادعا نشده", "Unclaimed")}</span>}
            </div>
          ))}
        </div>
      </section>

      <section id="community" className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><h3>💬 {t("پست اعضا", "Member posts")}</h3><span className="more"><ActionButton className="btn sm primary" label={t("نوشتن پست", "Write a post")} done={t("پیش‌نویس ثبت شد؛ پس از تأیید ما منتشر می‌شود", "Draft saved; published after our review")} /></span></div>
        <div className="list">
          {posts.filter((p) => p.hub === key && p.status === "published").map((p) => (
            <div key={p.t.en} className="item"><span className="avatar">{p.by[0]}</span><div className="grow"><b>{pick(p.t, locale)}</b><div className="muted small">{p.by} · {p.date}</div></div><button className="btn sm" title="DSA">⚑ {t("گزارش", "Report")}</button></div>
          ))}
        </div>
        <p className="muted small" style={{ marginTop: 8 }}>{t("همه پست‌ها پیش از انتشار بررسی می‌شوند. دکمه گزارش طبق قانون خدمات دیجیتال (DSA) است.", "Every post is reviewed before it goes live. The report button follows the Digital Services Act.")}</p>
      </section>

      <section id="tenders" className="card" style={{ marginBottom: 20 }}>
        <h3>📣 {t("مناقصه‌ها", "Tenders")} <span className="muted small">(TED · CPV)</span></h3>
        <table className="table">
          <thead><tr><th>{t("عنوان", "Title")}</th><th>CPV</th><th>{t("ارزش", "Value")}</th><th>{t("مهلت", "Deadline")}</th></tr></thead>
          <tbody>{tenders.filter((x) => x.hub === key).map((x) => <tr key={x.title.en}><td>{pick(x.title, locale)}</td><td className="ltr">{x.cpv}</td><td className="num">{x.value}</td><td className="num">{x.deadline}</td></tr>)}</tbody>
        </table>
      </section>

      <Newsletter c={c} hub={pick(industry.name, locale)} />
    </main>
  );
}
