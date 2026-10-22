import Link from "next/link";
import { getDb } from "@/db";
import { copyFor } from "@/config/site-copy";
import { listPublished } from "@/server/content";

export const revalidate = 3600;

export default async function LocaleHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = copyFor(locale);
  // The prototype must render even before the database has any published page.
  const pages = await listPublished(getDb(), locale).catch(() => []);
  const checkup = `/${locale}/checkup`;
  return (
    <main>
      <section className="wrap-site hero">
        <div>
          <span className="badge ai" style={{ marginBottom: 14 }}>✦ {c.hero.kicker}</span>
          <h1>{c.hero.title[0]} <em>{c.hero.title[1]}</em></h1>
          <p className="lead">{c.hero.lead}</p>
          <div className="row">
            <Link className="btn primary lg" href={checkup}>{c.hero.primary}</Link>
            <a className="btn lg" href="#how">{c.hero.secondary}</a>
          </div>
          <div className="row small muted" style={{ marginTop: 18, gap: 18 }}>
            {c.hero.proof.map((p) => <span key={p}>✓ {p}</span>)}
          </div>
        </div>
        <div className="hero-card">
          <div className="row" style={{ marginBottom: 12 }}>
            <b>{c.heroCard.title}</b>
            <span className="spacer" />
            <span className="muted small">{c.heroCard.company}</span>
          </div>
          <div className="row" style={{ gap: 24, alignItems: "center" }}>
            <div style={{ display: "grid", justifyItems: "center", gap: 6 }}>
              <div className="ring" style={{ ["--p" as string]: 68 }}><div>68</div></div>
              <div className="muted small">{c.heroCard.score}</div>
            </div>
            <div className="stack" style={{ flex: 1 }}>
              <div className="muted small">{c.heroCard.save}</div>
              <div style={{ fontSize: 30, fontWeight: 800 }} className="num">46 <span className="small muted">{c.heroCard.hours}</span></div>
              {c.heroCard.items.map((it, i) => (
                <div key={it} className="row small"><span className="badge ok">{i + 1}</span>{it}</div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="solutions">
        <div className="wrap-site">
          <h2>{c.ladder.title}</h2>
          <p className="sub">{c.ladder.sub}</p>
          <div className="ladder">
            {c.ladder.items.map((r) => (
              <div key={r.n} className={`rung ${r.free ? "free" : ""}`}>
                <div className="n">{r.n}</div>
                <h3>{r.title}</h3>
                <p className="muted small">{r.desc}</p>
                <div className="row" style={{ marginTop: 8 }}>
                  <b className="small">{r.price}</b>
                  <span className="spacer" />
                  {r.free && <Link className="btn primary sm" href={checkup}>{c.ladder.cta}</Link>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="industries" style={{ background: "var(--panel)", borderBlock: "1px solid var(--line)" }}>
        <div className="wrap-site">
          <h2>{c.industries.title}</h2>
          <p className="sub">{c.industries.sub}</p>
          <div className="grid g3">
            {c.industries.items.map((ind) => (
              <div key={ind.slug} className="industry" style={{ background: "var(--bg)" }}>
                <div className="icon">{ind.icon}</div>
                <h3 style={{ margin: 0 }}>{ind.name}</h3>
                <div className="muted small">{c.industries.painLabel} {ind.pain}</div>
                <div className="row">
                  {ind.markets.map((m) => <span key={m} className="badge gray">{m}</span>)}
                  <span className="spacer" />
                  <Link className="small" href={checkup}>{c.industries.more} ←</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="wrap-site">
          <h2>{c.how.title}</h2>
          <div className="grid g4" style={{ marginTop: 20 }}>
            {c.how.items.map((s, i) => (
              <div key={s.t} className="card">
                <div className="badge" style={{ marginBottom: 8 }}>{i + 1}</div>
                <h3>{s.t}</h3>
                <p className="muted small" style={{ margin: 0 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="latest">
        <div className="wrap-site">
          <h2>{c.latest.title}</h2>
          {pages.length === 0 ? (
            <div className="card empty">{c.latest.empty}</div>
          ) : (
            <div className="grid g3" style={{ marginTop: 20 }}>
              {pages.slice(0, 6).map((p) => (
                <article key={p.slug} className="card">
                  <h3><Link href={`/${locale}/${p.slug}`}>{p.title}</Link></h3>
                  {p.summary && <p className="muted small">{p.summary}</p>}
                </article>
              ))}
            </div>
          )}
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
