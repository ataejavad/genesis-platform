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
      const rows = (await res.json()) as { title: string; categoryName?: string | null; city?: string | null; state?: string | null; website?: string | null; phone?: string | null; totalScore?: number | null; reviewsCount?: number | null; url?: string | null; permanentlyClosed?: boolean | null }[];
      // Apify sends null for missing fields; our types (and the CRM's input check) want them absent
      const v = <T>(x: T | null | undefined) => (x === null ? undefined : x);
      return rows.map(
        (p): Place => ({ name: p.title, category: v(p.categoryName), city: v(p.city), region: v(p.state), website: v(p.website), phone: v(p.phone), rating: v(p.totalScore), reviews: v(p.reviewsCount), mapsUrl: v(p.url), closed: v(p.permanentlyClosed) }),
      );
    },
  };
}
