import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, LOCALES } from "@/config/locales";
import { copyFor } from "@/config/site-copy";
import { pick } from "@/mock/site";
import { visitorIndustry } from "@/ui/site/country";
import { CookieBanner, Newsletter } from "@/ui/site/SiteClient";
import { LanguageSuggest, LanguageSwitcher } from "@/ui/site/Language";
import "../../ui.css";

const siteName = process.env.SITE_NAME ?? "Legend Partner";

export const metadata: Metadata = {
  title: { default: siteName, template: `%s · ${siteName}` },
};

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { lang, dir } = LOCALES[locale];
  const c = copyFor(locale);
  const home = `/${locale}`;
  const mine = await visitorIndustry();
  return (
    <html lang={lang} dir={dir}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&display=swap" />
      </head>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <LanguageSuggest locale={locale} />
        <header className="site-header">
          <div className="in">
            <Link className="brand" href={home} style={{ textDecoration: "none" }}>
              <span className="logo">L</span>
              <span>{siteName}</span>
            </Link>
            <nav>
              <Link href={`${home}/market`}>{c.nav.market}</Link>
              {mine && <Link href={`${home}/hub/${mine.slug}`} title={c.nav.myIndustry}>{mine.icon} {pick(mine.name, locale)}</Link>}
              <Link href={`${home}/explore`}>{c.nav.explore}</Link>
              <Link href={`${home}/tools`}>{c.nav.tools}</Link>
              <a href={`${home}#latest`}>{c.nav.media}</a>
              <Link href={`${home}/partners`}>{c.nav.partners}</Link>
            </nav>
            <div className="cta">
              <LanguageSwitcher locale={locale} />
              <Link className="btn sm" href="/portal">{c.nav.login}</Link>
              <Link className="btn primary sm" href={`${home}/checkup`}>{c.nav.checkup}</Link>
            </div>
          </div>
          {mine && (
            <div className="wrap-site small mine-bar">
              ✦ {c.nav.myIndustry}: <b>{mine.icon} {pick(mine.name, locale)}</b> · <Link href={`${home}/explore`}>{c.nav.change}</Link>
            </div>
          )}
        </header>
        <div id="main">{children}</div>
        <footer className="site-footer">
          <div className="wrap-site"><Newsletter c={c} /></div>
          <div className="wrap-site cols">
            <div>
              <div style={{ fontWeight: 800, color: "var(--fg)", marginBottom: 6 }}>{siteName}</div>
              <p>{c.footer.about}</p>
            </div>
            <div className="stack">
              <b style={{ color: "var(--fg)" }}>{c.nav.market}</b>
              <Link href={`${home}/checkup`}>{c.nav.checkup}</Link>
              <Link href={`${home}/market`}>{c.nav.market}</Link>
              <Link href={`${home}/explore`}>{c.nav.explore}</Link>
              <Link href={`${home}/tools`}>{c.nav.tools}</Link>
            </div>
            <div className="stack">
              <b style={{ color: "var(--fg)" }}>{c.footer.company}</b>
              <Link href={`${home}/about`}>{c.about.title}</Link>
              <Link href={`${home}/partners`}>{c.nav.partners}</Link>
              <Link href="/portal">{c.nav.login}</Link>
              <Link href={`${home}/signup`}>{c.nav.signup}</Link>
              <Link href={`${home}/legal`}>{c.footer.legal}</Link>
              <span className="small">🎁 {c.footer.referral}</span>
            </div>
            <div className="stack">
              <b style={{ color: "var(--fg)" }}>{c.footer.forAgents}</b>
              <a href="/llms.txt" className="ltr">llms.txt</a>
              <a href="/api/v1/catalog" className="ltr">/api/v1/catalog</a>
              <a href="/sitemap.xml" className="ltr">sitemap.xml</a>
            </div>
          </div>
          <div className="wrap-site small" style={{ marginTop: 18 }}>© 2026 {siteName} · {c.footer.rights}</div>
        </footer>
        <CookieBanner c={c} />
      </body>
    </html>
  );
}
