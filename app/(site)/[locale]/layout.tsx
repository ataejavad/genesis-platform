import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, LOCALES } from "@/config/locales";
import { copyFor } from "@/config/site-copy";
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
  return (
    <html lang={lang} dir={dir}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&display=swap" />
      </head>
      <body>
        <header className="site-header">
          <div className="in">
            <Link className="brand" href={home} style={{ textDecoration: "none" }}>
              <span className="logo">L</span>
              <span>{siteName}</span>
            </Link>
            <nav>
              <a href={`${home}#solutions`}>{c.nav.solutions}</a>
              <a href={`${home}#industries`}>{c.nav.industries}</a>
              <a href={`${home}#latest`}>{c.nav.media}</a>
              <Link href={`${home}/partners`}>{c.nav.partners}</Link>
            </nav>
            <div className="cta">
              <Link className="btn sm" href="/portal">{c.nav.login}</Link>
              <Link className="btn primary sm" href={`${home}/checkup`}>{c.nav.checkup}</Link>
            </div>
          </div>
          <div className="wrap-site row small" style={{ gap: 14, paddingBottom: 8 }}>
            {Object.entries(LOCALES).map(([code, l]) => (
              <Link key={code} href={`/${code}`} hrefLang={l.lang} style={{ fontWeight: code === locale ? 700 : 400 }}>{l.label}</Link>
            ))}
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="wrap-site cols">
            <div>
              <div style={{ fontWeight: 800, color: "var(--fg)", marginBottom: 6 }}>{siteName}</div>
              <p>{c.footer.about}</p>
            </div>
            <div className="stack">
              <b style={{ color: "var(--fg)" }}>{c.nav.solutions}</b>
              <Link href={`${home}/checkup`}>{c.nav.checkup}</Link>
              <a href={`${home}#solutions`}>{c.nav.solutions}</a>
              <a href={`${home}#industries`}>{c.nav.industries}</a>
            </div>
            <div className="stack">
              <b style={{ color: "var(--fg)" }}>{c.footer.company}</b>
              <Link href={`${home}/partners`}>{c.nav.partners}</Link>
              <Link href="/portal">{c.nav.login}</Link>
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
      </body>
    </html>
  );
}
