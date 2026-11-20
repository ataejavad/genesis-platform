import type { Env } from "../registry";
import { chosen } from "../registry";
import { apifyMaps } from "./apify";

/*
 * Company finder source, provider-agnostic. COMPANY_SEARCH_PROVIDER = apify | import (auto: apify with its key).
 * "import" means no search: a list is imported (npm run agents:outbound -- --import file.json).
 */
export type Place = {
  name: string;
  category?: string;
  city?: string;
  region?: string;
  website?: string;
  phone?: string;
  rating?: number;
  reviews?: number;
  mapsUrl?: string;
  closed?: boolean;
};

export type CompanySearch = {
  provider: string;
  /** what one result costs us, for the cost per customer */
  eurPerResult: number;
  search: (q: { term: string; region: string; country: string; max: number }) => Promise<Place[]>;
};

export function companySearchFromEnv(env: Env = process.env, fetchImpl: typeof fetch = fetch): CompanySearch | null {
  return chosen("company_search", env) === "apify" && env.APIFY_TOKEN ? apifyMaps(env.APIFY_TOKEN, fetchImpl) : null;
}
