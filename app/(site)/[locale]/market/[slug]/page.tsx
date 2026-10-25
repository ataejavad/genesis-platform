import Link from "next/link";
import { notFound } from "next/navigation";
import { copyFor } from "@/config/site-copy";
import { tx } from "@/config/tx";
import { factsFor, industries, pick, products } from "@/mock/site";
import { getDb } from "@/db";
import { listPackages } from "@/server/projects";
import { OrderBox } from "@/ui/site/OrderBox";

export default async function ProductPage({ params, searchParams }: { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ industry?: string; country?: string }> }) {
  const { locale, slug } = await params;
  const { industry, country } = await searchParams;
  const p = products.find((x) => x.slug === slug);
  if (!p) notFound();
  const c = copyFor(locale);
  const t = (fa: string, en: string) => tx(locale, fa, en);
  const ind = industries.find((x) => x.slug === industry && p.industries.includes(x.slug)) ?? industries.find((x) => x.slug === p.industries[0])!;
  const cc = factsFor(ind, country ?? p.countries?.[0]).country.toLowerCase();
  // only catalogue packages can be ordered online (no protocol, no sale)
  const pkg = (await listPackages(getDb()).catch(() => [])).find((x) => x.slug === p.slug);
  const delivery = { native: t("داخل داشبورد شما (ساخت خودمان)", "Inside your dashboard (built by us)"), embedded: t("داخل داشبورد شما، با برند ما", "Inside your dashboard, our branding"), sso: t("ورود یک‌کلیکی از داشبورد", "One-click launch from your dashboard") }[p.delivery];
  return (
    <main className="wrap-site section">
      <div className="crumbs"><Link href={`/${locale}/market?industry=${ind.slug}&country=${cc}`}>{c.nav.market} › {pick(ind.name, locale)}</Link></div>
      <div className="grid g-2-1" style={{ alignItems: "start" }}>
        <div className="stack" style={{ gap: 18 }}>
          <div className="row"><span className="ico tile" style={{ padding: 0, width: 56, height: 56, fontSize: 30, placeItems: "center" }}>{p.icon}</span><div><h1 style={{ margin: 0 }}>{pick(p.name, locale)}</h1><div className="muted">{pick(p.kind, locale)} · ★ {p.rating} ({p.reviews}) · <span className="ltr">{p.process}</span></div></div></div>
          <div className="callout ai"><b>{t("نتیجه:", "Outcome:")}</b> {pick(p.outcome, locale)}</div>
          <div className="card"><h3>{t("چطور کار می‌کند", "How it works")}</h3><ol>{p.how.map((s) => <li key={s.en}>{pick(s, locale)}</li>)}</ol>
            <div className="row small"><span className="badge gray">⏱ {t("راه‌اندازی", "Setup")}: {pick(p.setup, locale)}</span><span className="badge gray">🖥 {delivery}</span><span className="badge ok">📐 {t("کیفیت تضمین‌شده با پروتکل", "Quality guaranteed by protocol")} {p.protocol}</span></div>
          </div>
          <div className="card" style={{ aspectRatio: "16/7", display: "grid", placeItems: "center", background: "linear-gradient(135deg, var(--brand-soft), var(--panel))" }}>
            <div className="muted">▶ {t("ویدیوی دمو (۹۰ ثانیه)", "Demo video (90 seconds)")}</div>
          </div>
          <div className="card"><h3>{t("نظر مشتری‌ها", "Customer reviews")}</h3>
            <div className="list"><div className="item"><span className="avatar">T</span><div className="grow">“{t("زمان قیمت‌دهی ما از ۲ روز به ۱۲ دقیقه رسید.", "Our quoting time went from 2 days to 12 minutes.")}”<div className="muted small">Thomas B., Glas Becker GmbH · ★★★★★</div></div></div></div>
          </div>
          {p.faq.length > 0 && <div className="card"><h3>{t("پرسش‌های رایج", "FAQ")}</h3>{p.faq.map((f) => <details key={f.q.en} style={{ marginBottom: 8 }}><summary><b>{pick(f.q, locale)}</b></summary><p className="muted">{pick(f.a, locale)}</p></details>)}</div>}
        </div>
        <OrderBox locale={locale} pkg={pkg ? { slug: pkg.slug, setupEur: pkg.setupEur, monthlyEur: pkg.monthlyEur } : null} industry={ind.slug} country={cc} plans={p.plans.map((pl) => ({ name: pl.name, price: pl.price, per: pick(pl.per, locale), features: pl.features.map((f) => pick(f, locale)) }))} />
      </div>
    </main>
  );
}
