// URL locale = language-country. A new country/language is one line here plus rows in `markets`.
export const LOCALES = {
  "en-gb": { lang: "en", country: "GB", dir: "ltr", label: "English (UK)" },
  "de-de": { lang: "de", country: "DE", dir: "ltr", label: "Deutsch" },
  "it-it": { lang: "it", country: "IT", dir: "ltr", label: "Italiano" },
  "fa-ir": { lang: "fa", country: "IR", dir: "rtl", label: "فارسی" },
} as const;

export type Locale = keyof typeof LOCALES;
export const DEFAULT_LOCALE: Locale = "en-gb";

export function isLocale(value: string): value is Locale {
  return Object.hasOwn(LOCALES, value);
}

// Best configured locale for an Accept-Language header, or null when none of the wanted languages exists.
export function matchLocale(acceptLanguage: string | null): Locale | null {
  if (!acceptLanguage) return null;
  const wanted = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of wanted) {
    if (isLocale(tag)) return tag;
    const byLang = (Object.keys(LOCALES) as Locale[]).find((l) => LOCALES[l].lang === tag.split("-")[0]);
    if (byLang) return byLang;
  }
  return null;
}

// Picks the best configured locale from an Accept-Language header.
export function negotiateLocale(acceptLanguage: string | null): Locale {
  return matchLocale(acceptLanguage) ?? DEFAULT_LOCALE;
}

// Countries whose visitors default to a locale when the browser language is not one we offer.
const COUNTRY_LOCALE: Record<string, Locale> = { DE: "de-de", AT: "de-de", CH: "de-de", IT: "it-it", SM: "it-it", GB: "en-gb", IE: "en-gb", IR: "fa-ir" };

// First visit order: saved choice (cookie) → browser language → IP country (hint only) → default.
// IP never overrides an explicit choice or the browser, and only "/" uses it: pages keep their URL (SEO, travellers).
export function pickLocale(input: { saved?: string | null; acceptLanguage?: string | null; country?: string | null }): Locale {
  if (input.saved && isLocale(input.saved)) return input.saved;
  return matchLocale(input.acceptLanguage ?? null) ?? COUNTRY_LOCALE[(input.country ?? "").toUpperCase()] ?? DEFAULT_LOCALE;
}

export const LOCALE_COOKIE = "lang";
