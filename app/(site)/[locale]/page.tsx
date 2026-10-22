import { getDb } from "@/db";
import { listPublished } from "@/server/content";

export const revalidate = 3600;

export default async function LocaleHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const pages = await listPublished(getDb(), locale);
  return (
    <main>
      {pages.length === 0 ? (
        <p className="muted">—</p>
      ) : (
        pages.map((p) => (
          <article key={p.slug} className="card">
            <h2 style={{ marginTop: 0 }}>
              <a href={`/${locale}/${p.slug}`}>{p.title}</a>
            </h2>
            {p.summary && <p className="muted">{p.summary}</p>}
          </article>
        ))
      )}
    </main>
  );
}
