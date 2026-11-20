import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getDb } from "@/db";
import { getPublished } from "@/server/content";

export const revalidate = 3600;

type Params = { params: Promise<{ locale: string; slug: string[] }> };

async function load({ params }: Params) {
  const { locale, slug } = await params;
  return getPublished(getDb(), locale, slug.join("/"));
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const page = await load(props);
  return page ? { title: page.title, description: page.summary ?? undefined } : {};
}

export default async function ContentPage(props: Params) {
  const page = await load(props);
  if (!page) notFound();
  // Machine-readable description of the page for search engines and buyer agents (doc 06 §3و).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": page.type === "article" ? "Article" : "WebPage",
    name: page.title,
    description: page.summary ?? undefined,
    inLanguage: page.locale,
    dateModified: page.updatedAt.toISOString(),
  };
  return (
    <main className="wrap-site section" style={{ maxWidth: 820 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <h1>{page.title}</h1>
      {page.summary && <p className="muted">{page.summary}</p>}
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{page.body}</ReactMarkdown>
    </main>
  );
}
