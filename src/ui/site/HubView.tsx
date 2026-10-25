import Link from "next/link";
import type { ReactNode } from "react";
import type { SiteCopy } from "@/config/site-copy";
import type { HubDoc, Source } from "@/server/hubs";
import { HubHook } from "./HubHook";

type Props = { doc: HubDoc; c: SiteCopy; locale: string; brand: string; country: ReactNode; now?: Date; preview?: boolean };

const fmtStat = (key: HubDoc["stats"][number]["key"], v: number, lang: string) => {
  const n = (x: number, d = 0) => x.toLocaleString(lang, { maximumFractionDigits: d });
  if (key === "turnover") return n(v / 1000, 1);
  if (key === "growth") return `${v > 0 ? "+" : ""}${n(v, 1)}%`;
  if (key === "aiUse" || key === "vacancy") return `${n(v, 1)}%`;
  return n(v);
};

function Sources({ list, label }: { list: Source[]; label: string }) {
  return (
    <span className="muted small">
      {label}:{" "}
      {list.map((s, i) => (
        <span key={s.url}>
          {i > 0 && " · "}
          <a href={s.url} target="_blank" rel="noopener nofollow">{s.name}</a>
          {s.kind === "official" && " ✓"}
        </span>
      ))}
    </span>
  );
}

/** One template for every industry hub (doc 15 §6ه.2); the content is the approved hub-builder page. */
export function HubView({ doc, c, locale, brand, country, now = new Date(), preview }: Props) {
  const h = c.hub;
  const lang = locale.slice(0, 2);
  const date = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  const daysTo = (d: string) => Math.ceil((new Date(`${d}T00:00:00Z`).getTime() - now.getTime()) / 86_400_000);
  const checkup = `/${locale}/checkup?industry=${doc.industry}&country=${doc.country.toLowerCase()}&from=hub`;
  return (
    <>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1>{doc.name}</h1>
          <p className="lead" style={{ maxWidth: 760 }}>{doc.tagline}</p>
          <p className="muted small">{h.updated} {date(doc.researchedAt)} · ✓ {h.checked}</p>
        </div>
        {country}
      </div>

      {preview ? null : (
        <HubHook
          hook={doc.hook}
          deadlines={doc.deadlines.map(({ id, tags, date: d, title, offer }) => ({ id, tags, date: d, title, offer }))}
          copy={h.hook}
          brand={brand}
          locale={locale}
          industry={doc.industry}
          country={doc.country}
        />
      )}

      <section id="deadlines" style={{ margin: "24px 0" }}>
        <h2>⏰ {h.deadlines}</h2>
        <div className="list">
          {doc.deadlines.map((d) => {
            const left = d.date ? daysTo(d.date) : null;
            return (
              <article key={d.id} id={`d-${d.id}`} className="card" style={{ marginBottom: 12 }}>
                <div className="card-head">
                  <h3 style={{ margin: 0 }}>{d.title}</h3>
                  <span className={`badge ${left !== null && left > 0 && left <= 90 ? "warn" : "gray"}`}>
                    {left === null ? h.inForce : left > 0 ? `${date(d.date!)} · ${h.daysLeft.replace("{n}", String(left))}` : h.started.replace("{d}", date(d.date!))}
                  </span>
                </div>
                <p>{d.what}</p>
                <p className="small"><b>✦ {h.forYou}:</b> {d.offer}</p>
                <Sources list={d.sources} label={h.sources} />
              </article>
            );
          })}
        </div>
      </section>

      <section id="overview" style={{ marginBottom: 24 }}>
        <p style={{ maxWidth: 820 }}>{doc.overview.text}</p>
        <div className="grid g3">
          {doc.stats.map((s) => (
            <div key={s.key} className="card stat">
              <div className="label">{h.stats[s.key]}</div>
              <div className="value num">{fmtStat(s.key, s.value, lang)}</div>
              <div className="delta muted">{s.source} · {s.period}</div>
            </div>
          ))}
        </div>
        <p className="muted small">NACE {doc.nace.join(" · ")}</p>
      </section>

      <div className="grid g2" style={{ marginBottom: 24 }}>
        <section className="card">
          <h3>{h.pains}</h3>
          <ul>{doc.pains.map((p) => <li key={p.text} style={{ marginBottom: 8 }}>{p.text}<br /><Sources list={p.sources} label={h.source} /></li>)}</ul>
        </section>
        <section className="card" id="solutions">
          <h3>{h.solutions}</h3>
          <ul>{doc.solutions.map((s) => <li key={s.title} style={{ marginBottom: 8 }}><b>{s.title}</b>: {s.outcome}</li>)}</ul>
          <div className="row">
            <Link className="btn primary" href={checkup}>{h.checkup}</Link>
            <Link className="btn" href={`/${locale}/market?industry=${doc.industry}&country=${doc.country.toLowerCase()}`}>{c.nav.market}</Link>
          </div>
        </section>
      </div>

      {doc.news.length > 0 && (
        <section id="news" className="card" style={{ marginBottom: 24 }}>
          <h3>📰 {h.news}</h3>
          <div className="list">
            {doc.news.map((n) => (
              <div key={n.url} className="item">
                <div className="grow">
                  <b>{n.title}</b>
                  <div className="small">✦ {h.ourTake}: {n.takeaway}</div>
                  <div className="muted small">{date(n.date)} · {h.readAt} <a href={n.url} target="_blank" rel="noopener nofollow">{n.publisher}</a></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!preview && (
        <div className="band" style={{ justifyContent: "space-between" }}>
          <b>{doc.hook.title}</b>
          <div className="row">
            <a className="btn primary" href="#hook">{h.hook.cta}</a>
            <Link className="btn" href={checkup}>{h.checkup}</Link>
          </div>
        </div>
      )}
    </>
  );
}
