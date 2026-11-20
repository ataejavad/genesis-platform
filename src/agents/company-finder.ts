import type { CompanySignals } from "@/server/market-selection/company-agent";
import type { Place } from "@/providers/company-search";

/*
 * Company finder (market selection agent 3, doc 13 §2.6 ج): businesses of a trade per search term and region
 * from data/outreach/targets.json, through the company-search provider (src/providers/company-search; Google Maps
 * via Apify today). Without one, a list can always be imported (npm run agents:outbound -- --import file.json).
 */
export { companySearchFromEnv, type Place } from "@/providers/company-search";

export type Found = CompanySignals & { listingName?: string; phone?: string; city?: string; mapsUrl?: string; category?: string; rating?: number; reviews?: number };

/**
 * Maps listing titles are often stuffed with keywords ("CONDIZIONATORI BRESCIA ❄️ Installazione Climatizzatori",
 * "Multitermo | Climatizzatori e pompe di calore a Bergamo"): keep the business name a person would write.
 */
export function cleanName(raw: string) {
  const parts = raw
    .split(/[\p{Extended_Pictographic}\u{FE0F}|–—·]|\s-\s/u)
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter((x) => x.length >= 3);
  // the part with a legal form is the company; otherwise the shortest part (the rest is keywords)
  const name = parts.find((x) => /\b(srl|srls|spa|snc|sas|s\.r\.l\.|s\.p\.a\.)\b/i.test(x)) ?? [...parts].sort((x, y) => x.length - y.length)[0] ?? raw.trim();
  // ALL CAPS reads as shouting in a message: Title Case, but keep legal forms as written
  const caps = name === name.toUpperCase() && /[A-Z]{4}/.test(name);
  return caps ? name.toLowerCase().replace(/(^|[\s.'(])\p{L}/gu, (m) => m.toUpperCase()).replace(/\b(Di|Del|Della|E)\b/g, (m) => m.toLowerCase()) : name;
}

/** A found place → the signals the scorer understands. Only what the listing shows; nothing guessed. */
export function toSignals(p: Place, t: { nace: string; region: string }): Found {
  return {
    name: cleanName(p.name),
    listingName: p.name !== cleanName(p.name) ? p.name : undefined,
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
