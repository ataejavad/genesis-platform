import type { Metadata } from "next";
import Link from "next/link";
import { copyFor } from "@/config/site-copy";

export const metadata: Metadata = { title: "About" };

// Public vision only. The long-term internal vision (doc 08) is never stated on the site.
export default async function About({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const c = copyFor(locale);
  return (
    <main className="wrap-site section" style={{ maxWidth: 860 }}>
      <h1>{c.about.title}</h1>
      <p className="lead" style={{ fontSize: 24, fontWeight: 700, margin: "12px 0 24px" }}>{c.about.vision}</p>
      <div className="stack" style={{ gap: 12 }}>
        {c.about.points.map((p) => <div key={p} className="card">{p}</div>)}
      </div>
      <div className="row" style={{ marginTop: 24 }}>
        <Link className="btn primary" href={`/${locale}/checkup`}>{c.nav.checkup}</Link>
        <Link className="btn" href={`/${locale}/partners`}>{c.nav.partners}</Link>
      </div>
    </main>
  );
}
