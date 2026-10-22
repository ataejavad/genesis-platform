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

// Picks the best configured locale from an Accept-Language header.
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
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
  return DEFAULT_LOCALE;
}
