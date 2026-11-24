import type { Env } from "../registry";
import { chosen } from "../registry";
import { DEFAULT_FEEDS, rssFeed } from "./rss";

/*
 * Where the solutions radar reads what is new: product launches and technology news. NEWS_FEED_PROVIDER = rss | mock
 * (auto: rss, free, no key). The list of feeds is RADAR_FEEDS ("Name|https://…/feed, …"), default DEFAULT_FEEDS.
 * A paid or keyed source (Product Hunt API, a news API) is one more adapter file here.
 */

export type FeedItem = {
  /** the feed it came from, e.g. "Product Hunt" */
  source: string;
  title: string;
  url: string;
  publishedAt: Date | null;
  /** the feed's own short description, plain text, cut; used for analysis only, never published */
  summary: string;
};

export type NewsFeed = {
  provider: string;
  /** items published after `since` (items without a date are kept); feeds that fail are listed in `errors` */
  fetch: (since: Date) => Promise<{ items: FeedItem[]; errors: string[] }>;
};

export function mockFeed(items: FeedItem[] = []): NewsFeed {
  return { provider: "mock", fetch: async (since) => ({ items: items.filter((i) => !i.publishedAt || i.publishedAt > since), errors: [] }) };
}

/** "Name|url, Name|url" → feeds; a bare url is named by its host. */
export function parseFeedList(s: string | undefined) {
  if (!s?.trim()) return DEFAULT_FEEDS;
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [a, b] = x.includes("|") ? x.split("|") : [null, x];
      const url = (b ?? "").trim();
      return { name: (a ?? new URL(url).hostname).trim(), url };
    })
    .filter((f) => f.url.startsWith("https://"));
}

export function newsFeedFromEnv(env: Env = process.env, fetchImpl: typeof fetch = fetch): NewsFeed {
  switch (chosen("news_feed", env)) {
    case "mock":
      return mockFeed();
    default:
      return rssFeed(parseFeedList(env.RADAR_FEEDS), fetchImpl);
  }
}
