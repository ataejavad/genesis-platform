import Link from "next/link";
import { copyFor } from "@/config/site-copy";
import { tx } from "@/config/tx";
import { hubs, pick, products } from "@/mock/site";

// Industry-specific marketplace (doc 15 §6ه.5): no generic aisle, the visitor picks an industry first.
export default async function Market({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ hub?: string }> }) {
  const { locale } = await params;
  const { hub } = await searchParams;
  const c = copyFor(locale);
  const live = hubs.filter((h) => h.live);
  const current = live.find((h) => h.slug === hub);
  const list = current ? products.filter((p) => p.hubs.includes(current.slug)) : [];
  return (
    <main className="wrap-site section">
      <h1>{c.market.title}</h1>
      <p className="muted">{c.market.sub}</p>
      <div className="row" style={{ margin: "16px 0 24px" }} role="group" aria-label={c.market.pick}>
        <b className="small">{c.market.pick}:</b>
        {live.map((h) => (
          <Link key={h.slug} href={`/${locale}/market?hub=${h.slug}`} className="chip" aria-current={h.slug === hub ? "true" : undefined} style={h.slug === hub ? { borderColor: "var(--brand)", background: "var(--brand-soft)" } : undefined}>
            {h.icon} {pick(h.name, locale)} {h.flag}
          </Link>
        ))}
      </div>
      {!current && <div className="card empty">{c.market.pick} ↑</div>}
      {current && (
        <div className="grid g2">
          {list.map((p) => (
            <Link key={p.slug} className="tile" href={`/${locale}/market/${p.slug}?hub=${current.slug}`}>
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
