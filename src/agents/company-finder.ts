import type { CompanySignals } from "@/server/market-selection/company-agent";

/*
 * Company finder (market selection agent 3, doc 13 §2.6 ج): Google Maps through Apify, per search term and
 * region from data/outreach/targets.json. Off until APIFY_TOKEN is set; a list can always be imported instead
 * (npm run agents:outbound -- --import file.json). One place costs about $0.004 (Apify's Maps actor).
 */

export const finderEnabled = () => Boolean(process.env.APIFY_TOKEN);
export const EUR_PER_PLACE = 0.004;

export type Place = {
  title: string;
  categoryName?: string;
  city?: string;
  state?: string;
  website?: string;
  phone?: string;
  totalScore?: number;
  reviewsCount?: number;
  url?: string;
  permanentlyClosed?: boolean;
};

export type Found = CompanySignals & { phone?: string; city?: string; mapsUrl?: string; category?: string; rating?: number; reviews?: number };

export async function findPlaces(search: string, region: string, country: string, max: number, fetchImpl: typeof fetch = fetch): Promise<Place[]> {
  const res = await fetchImpl(`https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${process.env.APIFY_TOKEN}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ searchStringsArray: [search], locationQuery: `${region}, ${country === "IT" ? "Italia" : country}`, maxCrawledPlacesPerSearch: max, language: country === "IT" ? "it" : "en", skipClosedPlaces: true }),
    signal: AbortSignal.timeout(280_000),
  });
  if (!res.ok) throw new Error(`apify ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()) as Place[];
}

/** A Maps place → the signals the scorer understands. Only what the listing shows; nothing guessed. */
export function toSignals(p: Place, t: { nace: string; region: string }): Found {
  return {
    name: p.title,
    website: p.website,
    phone: p.phone,
    nace: t.nace,
    region: p.state ?? t.region,
    city: p.city,
    outdatedWebsite: !p.website,
    slowServiceReviews: p.totalScore !== undefined && p.totalScore < 4 && (p.reviewsCount ?? 0) >= 10,
    publicEmailOrPhone: Boolean(p.phone),
    mapsUrl: p.url,
    category: p.categoryName,
    rating: p.totalScore,
    reviews: p.reviewsCount,
    evidence: p.url ? { listing: p.url } : {},
  };
}
