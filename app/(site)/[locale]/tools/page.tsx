import Link from "next/link";
import { copyFor } from "@/config/site-copy";
import { freeTools, pick } from "@/mock/site";
import { RoiCalc } from "@/ui/site/SiteClient";

export default async function Tools({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = copyFor(locale);
  return (
    <main className="wrap-site section">
      <h1>{c.tools.title}</h1>
      <p className="muted">{c.tools.sub}</p>
      <div style={{ margin: "20px 0" }}><RoiCalc fa={locale.startsWith("fa")} /></div>
      <div className="grid g3">
        {freeTools.slice(1).map((t) => (
          <Link key={t.slug} className="tile" href={t.slug === "checkup" ? `/${locale}/checkup` : `/${locale}/hub/glass-de#tenders`}>
            <span className="ico">{t.icon}</span><b>{pick(t.name, locale)}</b><span className="muted small">{pick(t.desc, locale)}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
