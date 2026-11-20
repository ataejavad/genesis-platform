import type { Metadata } from "next";
import Link from "next/link";
import { copyFor } from "@/config/site-copy";
import { industries, pick, sectors } from "@/mock/site";
import { ActionButton } from "@/ui/site/SiteClient";

export const metadata: Metadata = { title: "Explore industries" };

// Explore (doc 15 §6ه.2): the whole NACE tree for visitors who want to browse. Everyone else lands in their
// own industry via the chat, a typed answer or a saved choice, so the default site stays specialist.
export default async function Explore({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> }) {
  const { locale } = await params;
  const q = ((await searchParams).q ?? "").trim().toLowerCase();
  const c = copyFor(locale);
  const match = (sub: (typeof sectors)[number]["subs"][number], sector: (typeof sectors)[number]) =>
    !q || [sub.nace, sub.name.en, sub.name.fa, sector.name.en, sector.name.fa].some((s) => s.toLowerCase().includes(q));
  const shown = sectors.map((s) => ({ ...s, subs: s.subs.filter((sub) => match(sub, s)) })).filter((s) => s.subs.length);
  return (
    <main className="wrap-site section">
      <h1>{c.explore.title}</h1>
      <p className="sub muted">{c.explore.sub}</p>
      <form className="row" style={{ margin: "16px 0 24px", maxWidth: 560 }}>
        <label className="sr-only" htmlFor="explore-q">{c.explore.search}</label>
        <input id="explore-q" name="q" defaultValue={q} placeholder={c.explore.search} style={{ flex: 1 }} />
        <button className="btn">🔍</button>
      </form>
      {shown.length === 0 && <div className="card empty">{c.explore.none} <Link href={`/${locale}/checkup`}>{c.nav.checkup}</Link></div>}
      <div className="stack" style={{ gap: 16 }}>
        {shown.map((s) => (
          <section key={s.code} className="card">
            <h3><span className="badge gray ltr">{s.code}</span> {pick(s.name, locale)}</h3>
            <div className="list">
              {s.subs.map((sub) => {
                const ind = industries.find((i) => i.slug === sub.industry);
                return (
                  <div key={sub.nace} className="item">
                    <span className="badge gray ltr">{sub.nace}</span>
                    <div className="grow"><b>{pick(sub.name, locale)}</b></div>
                    {ind?.live ? (
                      <>
                        {ind.countries.map((f) => (
                          <Link key={f.country} href={`/${locale}/hub/${ind.slug}/${f.country.toLowerCase()}`} title={f.country} style={{ fontSize: 20, textDecoration: "none" }}>{f.flag}</Link>
                        ))}
                        <Link className="btn sm primary" href={`/${locale}/hub/${ind.slug}`}>{c.explore.live}</Link>
                      </>
                    ) : ind ? (
                      <span className="badge warn">{c.explore.soon}</span>
                    ) : (
                      <ActionButton className="btn sm" label={c.explore.request} done={c.explore.requested} />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
