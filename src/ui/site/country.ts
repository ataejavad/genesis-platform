import { cookies, headers } from "next/headers";
import { LOCALES, isLocale } from "@/config/locales";
import { liveIndustries } from "@/mock/site";

export const COUNTRY_COOKIE = "country";
export const INDUSTRY_COOKIE = "industry";

// Country a hub opens on when the URL names none: saved choice → country of the site locale → IP country.
// Callers fall back to the industry's first country when the industry does not cover the result.
export async function visitorCountries(locale: string): Promise<string[]> {
  const saved = (await cookies()).get(COUNTRY_COOKIE)?.value;
  const h = await headers();
  const ip = h.get("cf-ipcountry") ?? h.get("x-vercel-ip-country");
  return [saved, isLocale(locale) ? LOCALES[locale].country : null, ip].filter((c): c is string => !!c).map((c) => c.toUpperCase());
}

// The visitor's own industry, once the chat, a typed answer or Explore told us; the whole site then serves it.
// Logged-in customers will read it from their organisation profile instead (organizations.market_id).
export async function visitorIndustry() {
  const slug = (await cookies()).get(INDUSTRY_COOKIE)?.value;
  return liveIndustries.find((i) => i.slug === slug);
}
