import type { CompanySignals } from "@/server/market-selection/company-agent";
import type { Place } from "@/providers/company-search";

/*
 * Company finder (market selection agent 3, doc 13 §2.6 ج): businesses of a trade per search term and region
 * from data/outreach/targets.json, through the company-search provider (src/providers/company-search; Google Maps
 * via Apify today). Without one, a list can always be imported (npm run agents:outbound -- --import file.json).
 */
export { companySearchFromEnv, type Place } from "@/providers/company-search";

export type Found = CompanySignals & { phone?: string; city?: string; mapsUrl?: string; category?: string; rating?: number; reviews?: number };

/** A found place → the signals the scorer understands. Only what the listing shows; nothing guessed. */
export function toSignals(p: Place, t: { nace: string; region: string }): Found {
  return {
    name: p.name,
    website: p.website,
    phone: p.phone,
    nace: t.nace,
    region: p.region ?? t.region,
    city: p.city,
    outdatedWebsite: !p.website,
    slowServiceReviews: p.rating !== undefined && p.rating < 4 && (p.reviews ?? 0) >= 10,
    publicEmailOrPhone: Boolean(p.phone),
    mapsUrl: p.mapsUrl,
    category: p.category,
    rating: p.rating,
    reviews: p.reviews,
    evidence: p.mapsUrl ? { listing: p.mapsUrl } : {},
  };
}
