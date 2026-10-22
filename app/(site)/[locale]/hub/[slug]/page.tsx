import Link from "next/link";
import { notFound } from "next/navigation";
import { copyFor } from "@/config/site-copy";
import { tx } from "@/config/tx";
import { companies, hubs, news, pick, posts, products, tenders } from "@/mock/site";
import { ActionButton, Newsletter } from "@/ui/site/SiteClient";

// Industry × country hub template (doc 15 §6ه.2): built once, filled per hub by agents.
export default async function Hub({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const hub = hubs.find((h) => h.slug === slug);
  if (!hub) notFound();
  const c = copyFor(locale);
  const t = (fa: string, en: string) => tx(locale, fa, en);
  const hubProducts = products.filter((p) => p.hubs.includes(slug));
  return (
    <main className="wrap-site section">
      <div className="crumbs"><Link href={`/${locale}/industries`}>{c.nav.hubs}</Link> › <span className="ltr">NACE {hub.nace}</span></div>
      <div className="row" style={{ alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1>{hub.icon} {pick(hub.name, locale)} {hub.flag}</h1>
          <p className="muted" style={{ maxWidth: 720 }}>{pick(hub.overview, locale)}</p>
        </div>
        {!hub.live && <span className="badge warn">{t("پیش‌نمایش: هنوز منتشر نشده", "Preview: not published yet")}</span>}
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
      <div className="grid g2" style={{ marginBottom: 20 }}>
        <div className="card"><h3>{t("دردهای رایج این صنف", "Typical pains in this trade")}</h3><ul>{hub.pains.map((p) => <li key={p.en}>{pick(p, locale)}</li>)}</ul></div>
        <div className="card"><h3>{t("قوانین مهم", "Key rules")}</h3><p>{pick(hub.law, locale)}</p><p className="muted small">{t("به‌روزرسانی خودکار توسط ایجنت محتوا، با تأیید.", "Kept up to date by the content agent, with approval.")}</p></div>
      </div>

      <section id="news" className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><h3>📰 {t("خبر و نوآوری امروز", "Today's news & innovation")}</h3><span className="more muted">{t("هر روز ۶:۰۰ به‌روز می‌شود", "Updated daily 06:00")}</span></div>
        <div className="list">
          {news.filter((n) => n.hub === slug).map((n) => (
            <div key={n.t.en} className="item"><div className="grow"><b>{pick(n.t, locale)}</b><div className="muted small">{n.src} · {n.date}</div></div><span className="badge ai">✦ {pick(n.ai, locale)}</span></div>
          ))}
        </div>
      </section>

      <section id="solutions" style={{ marginBottom: 20 }}>
        <h2>{c.market.title}</h2>
        <div className="grid g3">
          {hubProducts.map((p) => (
            <Link key={p.slug} className="tile" href={`/${locale}/market/${p.slug}`}>
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
          {companies.filter((co) => co.hub === slug).map((co) => (
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
          {posts.filter((p) => p.hub === slug && p.status === "published").map((p) => (
            <div key={p.t.en} className="item"><span className="avatar">{p.by[0]}</span><div className="grow"><b>{pick(p.t, locale)}</b><div className="muted small">{p.by} · {p.date}</div></div><button className="btn sm" title="DSA">⚑ {t("گزارش", "Report")}</button></div>
          ))}
        </div>
        <p className="muted small" style={{ marginTop: 8 }}>{t("همه پست‌ها پیش از انتشار بررسی می‌شوند. دکمه گزارش طبق قانون خدمات دیجیتال (DSA) است.", "Every post is reviewed before it goes live. The report button follows the Digital Services Act.")}</p>
      </section>

      <section id="tenders" className="card" style={{ marginBottom: 20 }}>
        <h3>📣 {t("مناقصه‌ها", "Tenders")} <span className="muted small">(TED · CPV)</span></h3>
        <table className="table">
          <thead><tr><th>{t("عنوان", "Title")}</th><th>CPV</th><th>{t("ارزش", "Value")}</th><th>{t("مهلت", "Deadline")}</th></tr></thead>
          <tbody>{tenders.filter((x) => x.hub === slug).map((x) => <tr key={x.title.en}><td>{pick(x.title, locale)}</td><td className="ltr">{x.cpv}</td><td className="num">{x.value}</td><td className="num">{x.deadline}</td></tr>)}</tbody>
        </table>
      </section>

      <Newsletter c={c} hub={pick(hub.name, locale)} />
    </main>
  );
}
