import type { FeedItem, NewsFeed } from "./index";

/*
 * Public RSS / Atom feeds (free, no key, read as any feed reader does). Default list: product launches and
 * technology news that small firms' tools come from. Only titles, links, dates and the feed's short description are
 * read; analysis happens in our agent and anything we publish is our own text with a link to the source.
 */
export const DEFAULT_FEEDS = [
  { name: "Product Hunt", url: "https://www.producthunt.com/feed" },
  { name: "Hacker News (Show HN)", url: "https://hnrss.org/show?points=60" },
  { name: "TechCrunch", url: "https://techcrunch.com/feed/" },
  { name: "EU-Startups", url: "https://www.eu-startups.com/feed/" },
  { name: "Hugging Face blog", url: "https://huggingface.co/blog/feed.xml" },
  { name: "The Verge AI", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml" },
];

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
const strip = (s: string) => s.replace(/<[^>]+>/g, " ");
/** Text of a feed field: CDATA unwrapped, tags removed, entities decoded (escaped HTML descriptions too). */
export function plain(s: string) {
  return strip(decode(strip(s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"))))
    .replace(/\s+/g, " ")
    .trim();
}

function decode(s: string) {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => {
    if (ENTITIES[e]) return ENTITIES[e];
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return m;
  });
}

const tag = (block: string, name: string) => block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"))?.[1];

/** Items of an RSS 2.0 or Atom document. */
export function parseFeed(xml: string, source: string): FeedItem[] {
  const blocks = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].map((m) => m[2]);
  return blocks.flatMap((b) => {
    const title = plain(tag(b, "title") ?? "");
    // Atom: <link rel="alternate" href="…"/>; RSS: <link>…</link>
    const href = b.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i)?.[1] ?? b.match(/<link\b[^>]*href=["']([^"']+)["']/i)?.[1] ?? plain(tag(b, "link") ?? "");
    const url = href.replace(/&amp;/g, "&").trim();
    if (!title || !/^https?:\/\//.test(url)) return [];
    const when = tag(b, "pubDate") ?? tag(b, "published") ?? tag(b, "updated") ?? tag(b, "dc:date");
    const t = when ? Date.parse(plain(when)) : NaN;
    const summary = plain(tag(b, "description") ?? tag(b, "summary") ?? tag(b, "content") ?? "").slice(0, 400);
    return [{ source, title: title.slice(0, 300), url, publishedAt: Number.isFinite(t) ? new Date(t) : null, summary }];
  });
}

export function rssFeed(feeds: { name: string; url: string }[], fetchImpl: typeof fetch = fetch): NewsFeed {
  return {
    provider: "rss",
    async fetch(since) {
      const errors: string[] = [];
      const lists = await Promise.all(
        feeds.map(async (f) => {
          try {
            const r = await fetchImpl(f.url, { headers: { "user-agent": "Mozilla/5.0 (compatible; GenesisRadar/1.0; feed reader)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(15_000) });
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return parseFeed(await r.text(), f.name);
          } catch (err) {
            errors.push(`${f.name}: ${err instanceof Error ? err.message.slice(0, 80) : "failed"}`);
            return [];
          }
        }),
      );
      return { items: lists.flat().filter((i) => !i.publishedAt || i.publishedAt > since), errors };
    },
  };
}
