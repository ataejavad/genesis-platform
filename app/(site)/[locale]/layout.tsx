import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, LOCALES } from "@/config/locales";
import "../../globals.css";

const siteName = process.env.SITE_NAME ?? "Genesis";

export const metadata: Metadata = {
  title: { default: siteName, template: `%s · ${siteName}` },
};

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { lang, dir } = LOCALES[locale];
  return (
    <html lang={lang} dir={dir}>
      <body>
        <div className="wrap">
          <header className="site">
            <a className="brand" href={`/${locale}`}>{siteName}</a>
            <nav className="row">
              {Object.entries(LOCALES).map(([code, l]) => (
                <a key={code} href={`/${code}`} hrefLang={l.lang}>{l.label}</a>
              ))}
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
