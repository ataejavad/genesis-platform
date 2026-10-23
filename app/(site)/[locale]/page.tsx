import Link from "next/link";
import { getDb } from "@/db";
import { copyFor } from "@/config/site-copy";
import { listPublished } from "@/server/content";
import { checkupDefsFor } from "@/ui/site/checkup-defs";
import { factsFor, freeTools, hubKey, liveIndustries, news, pick, tenders } from "@/mock/site";
import { visitorCountries, visitorIndustry } from "@/ui/site/country";
import { Concierge } from "@/ui/site/Concierge";

const brand = process.env.SITE_NAME ?? "Legend Partner";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ as?: string }> };

export default async function LocaleHome({ params, searchParams }: Props) {
  const { locale } = await params;
  // Demo of logged-in personalisation (doc 15 §6و): ?as=glas-becker shows the site as that customer sees it.
  const { as } = await searchParams;
  const c = copyFor(locale);
  const pages = (await listPublished(getDb(), locale).catch(() => [])).filter((p) => p.type !== "industry-hub");
  const checkup = `/${locale}/checkup`;
  // A known industry (saved choice, or the demo customer ?as=glas-becker) turns the home page specialist.
  const mine = as === "glas-becker" ? liveIndustries[0] : await visitorIndustry();
  const facts = mine && factsFor(mine, as === "glas-becker" ? "DE" : (await visitorCountries(locale)).find((cc) => mine.countries.some((f) => f.country === cc)));
  const myHub = mine && facts ? { ...mine, flag: facts.flag, key: hubKey(mine.slug, facts.country), href: `/${locale}/hub/${mine.slug}/${facts.country.toLowerCase()}` } : undefined;
  return (
    <main>
      {myHub && (
        <section className="wrap-site" style={{ paddingTop: 20 }}>
          <div className="callout ai">
            <div className="row">
              <span>✦ {as === "glas-becker" && <>{c.personal.welcome}, Thomas · </>}<b>{c.personal.yourHub}: {myHub.icon} {pick(myHub.name, locale)} {myHub.flag}</b></span>
              <span className="spacer" />
              <Link className="btn sm primary" href={myHub.href}>{c.hubs.open}</Link>
              <Link className="btn sm" href={`/${locale}/explore`}>{c.nav.change}</Link>
            </div>
            <ul className="small" style={{ margin: "8px 0 0" }}>
              {news.filter((n) => n.hub === myHub.key).slice(0, 2).map((n) => <li key={n.t.en}>📰 {pick(n.t, locale)}</li>)}
              {tenders.filter((t) => t.hub === myHub.key).slice(0, 1).map((t) => <li key={t.title.en}>📣 {pick(t.title, locale)} · {t.value}</li>)}
            </ul>
          </div>
        </section>
      )}
      <section className="wrap-site" style={{ padding: "48px 20px 40px" }}>
        <span className="badge ai" style={{ marginBottom: 14 }}>✦ {c.hero.kicker}</span>
        <div className="hero" style={{ padding: 0, gridTemplateColumns: "1fr", gap: 10 }}>
          <h1 style={{ margin: 0 }}>{c.hero.title[0]} <em>{c.hero.title[1]}</em></h1>
          <p className="lead" style={{ maxWidth: 760 }}>{c.hero.lead}</p>
        </div>
        <Concierge locale={locale} c={c} brand={brand} checkups={checkupDefsFor(locale)} visitorIndustry={mine?.slug} />
        <div className="row small muted" style={{ marginTop: 18, gap: 18 }}>
          {c.hero.proof.map((p) => <span key={p}>✓ {p}</span>)}
        </div>
      </section>

      <section className="section" id="solutions" style={{ background: "var(--panel)", borderBlock: "1px solid var(--line)" }}>
        <div className="wrap-site">
          <h2>{c.ladder.title}</h2>
          <p className="sub">{c.ladder.sub}</p>
          <div className="ladder">
            {c.ladder.items.map((r) => (
              <div key={r.n} className={`rung ${r.free ? "free" : ""}`} style={{ background: "var(--bg)" }}>
                <div className="n">{r.n}</div>
                <h3>{r.title}</h3>
                <p className="muted small">{r.desc}</p>
                <div className="row" style={{ marginTop: 8 }}>
                  <b className="small">{r.price}</b>
                  <span className="spacer" />
                  {r.free ? <Link className="btn primary sm" href={checkup}>{c.ladder.cta}</Link> : <Link className="btn sm" href={`/${locale}/market`}>→</Link>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="industries">
        <div className="wrap-site">
          <h2>{c.hubs.title}</h2>
          <p className="sub">{c.hubs.sub}</p>
          <div className="grid g3">
            {liveIndustries.map((i) => (
              <div key={i.slug} className="industry">
                <div className="row"><span className="icon">{i.icon}</span><span className="spacer" /><span className="badge gray ltr">NACE {i.nace}</span></div>
                <h3 style={{ margin: 0 }}>{pick(i.name, locale)}</h3>
                <div className="muted small">{i.countries.reduce((n, f) => n + f.stats.companies, 0).toLocaleString("en-US")} {c.hubs.companies} · {i.countries[0].pains.map((p) => pick(p, locale)).join(" · ")}</div>
                <div className="row">
                  {i.countries.map((f) => <span key={f.country} title={f.country} style={{ fontSize: 20 }}>{f.flag}</span>)}
                  <span className="spacer" />
                  <Link className="btn sm primary" href={`/${locale}/hub/${i.slug}`}>{c.hubs.open}</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap-site">
          <h2>{c.tools.title}</h2>
          <p className="sub">{c.tools.sub}</p>
          <div className="grid g4">
            {freeTools.map((t) => (
              <Link key={t.slug} className="tile" href={t.slug === "checkup" ? checkup : `/${locale}/tools`}>
                <span className="ico">{t.icon}</span>
                <b>{pick(t.name, locale)}</b>
                <span className="muted small">{pick(t.desc, locale)}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="latest" style={{ paddingTop: 0 }}>
        <div className="wrap-site">
          <h2>{c.nav.media}</h2>
          <div className="grid g3" style={{ marginTop: 16 }}>
            {pages.slice(0, 3).map((p) => (
              <article key={p.slug} className="card">
                <h3><Link href={`/${locale}/${p.slug}`}>{p.title}</Link></h3>
                {p.summary && <p className="muted small">{p.summary}</p>}
              </article>
            ))}
            {news.slice(0, 3 - Math.min(3, pages.length)).map((n) => (
              <article key={n.t.en} className="card">
                <div className="muted small">{n.src} · {n.date}</div>
                <h3>{pick(n.t, locale)}</h3>
                <p className="small" style={{ margin: 0 }}>✦ {pick(n.ai, locale)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap-site" style={{ paddingBottom: 24 }}>
        <div className="band">
          <div style={{ flex: 1 }}>
            <h2 style={{ marginBottom: 4 }}>{c.band.title}</h2>
            <div style={{ opacity: 0.9 }}>{c.band.sub}</div>
          </div>
          <Link className="btn lg" href={checkup}>{c.band.cta}</Link>
        </div>
      </section>
    </main>
  );
}
