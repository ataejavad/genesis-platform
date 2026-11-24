import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MEDIA } from "@/config/media";
import { isLocale } from "@/config/locales";
import { copyFor } from "@/config/site-copy";
import { getDb } from "@/db";
import { publicMedia } from "@/server/media";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const c = copyFor(locale);
  return { title: c.media.title, description: c.media.sub };
}

// The posts we publish on our LinkedIn company page, kept on our own site too (Javad 2026-11-24): every post ends in the
// free check-up or the newsletter, and the newsletter sign-up sits in the footer of this page.
const URL_RE = /(https?:\/\/[^\s]+)/g;
function Text({ text }: { text: string }) {
  return (
    <p style={{ whiteSpace: "pre-line", margin: 0, lineHeight: 1.6 }}>
      {text.split(URL_RE).map((part, i) => (i % 2 ? <a key={i} href={part} rel="noopener" style={{ wordBreak: "break-all" }}>{part.replace(/^https?:\/\//, "").replace(/\?.*$/, "")}</a> : part))}
    </p>
  );
}

export default async function Media({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = copyFor(locale);
  const posts = await publicMedia(getDb()).catch(() => []);
  return (
    <main className="wrap-site section" style={{ maxWidth: 760 }}>
      <h1>{c.media.title}</h1>
      <p className="lead muted" style={{ margin: "8px 0 16px" }}>{c.media.sub}</p>
      <div className="row" style={{ marginBottom: 28 }}>
        <a className="btn primary sm" href="#newsletter">{c.media.newsletter}</a>
        <a className="btn sm" href={MEDIA.linkedinPage} rel="noopener">{c.media.follow}</a>
      </div>
      {posts.length === 0 && <div className="card muted">{c.media.empty}</div>}
      <div className="stack" style={{ gap: 28 }}>
        {posts.map((p) => {
          const rest = p.body.startsWith(p.title) ? p.body.slice(p.title.length).trim() : p.body;
          return (
            <article key={p.id} className="card" id={`post-${p.id.slice(0, 8)}`} lang={p.lang} style={{ padding: 0, overflow: "hidden" }}>
              {p.imageUrl && <img src={p.imageUrl} alt={p.title} width={1200} height={1200} loading="lazy" style={{ width: "100%", height: "auto", display: "block" }} />}
              <div style={{ padding: 20 }}>
                <div className="muted small">{p.publishedAt?.toISOString().slice(0, 10)}</div>
                <h2 style={{ margin: "6px 0 12px" }}>{p.title}</h2>
                <Text text={rest} />
                {p.sourceUrl && <p className="small muted" style={{ marginTop: 12 }}>{c.media.source}: <a href={p.sourceUrl} rel="noopener">{p.sourceTitle ?? p.sourceUrl}</a></p>}
                <div className="row" style={{ marginTop: 16 }}>
                  {p.cta === "checkup"
                    ? <Link className="btn primary sm" href={`/${locale}/checkup?from=media-${p.id.slice(0, 8)}${p.industry ? `&industry=${p.industry}` : ""}`}>{c.media.checkup}</Link>
                    : <a className="btn primary sm" href="#newsletter">{c.media.newsletter}</a>}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
