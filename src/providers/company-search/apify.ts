import type { CompanySearch, Place } from ".";

/** Google Maps through Apify's Maps actor (APIFY_TOKEN). One place costs about $0.004. */
export function apifyMaps(token: string, fetchImpl: typeof fetch = fetch): CompanySearch {
  return {
    provider: "apify",
    eurPerResult: 0.004,
    async search({ term, region, country, max }) {
      const res = await fetchImpl(`https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${token}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ searchStringsArray: [term], locationQuery: `${region}, ${country === "IT" ? "Italia" : country}`, maxCrawledPlacesPerSearch: max, language: country === "IT" ? "it" : "en", skipClosedPlaces: true }),
        signal: AbortSignal.timeout(280_000),
      });
      if (!res.ok) throw new Error(`apify ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const rows = (await res.json()) as { title: string; categoryName?: string; city?: string; state?: string; website?: string; phone?: string; totalScore?: number; reviewsCount?: number; url?: string; permanentlyClosed?: boolean }[];
      return rows.map(
        (p): Place => ({ name: p.title, category: p.categoryName, city: p.city, region: p.state, website: p.website, phone: p.phone, rating: p.totalScore, reviews: p.reviewsCount, mapsUrl: p.url, closed: p.permanentlyClosed }),
      );
    },
  };
}
