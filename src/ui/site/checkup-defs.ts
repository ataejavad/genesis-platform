import { LOCALES, isLocale } from "@/config/locales";
import { industries, pick } from "@/mock/site";
import { checkupIndustries, loadCheckupDef, localizeDef } from "@/server/checkup";
import { loadResearch } from "@/server/hubs";

// Check-up questions for every live industry that has a definition, in the visitor's language (server only).
export function checkupDefsFor(locale: string) {
  const lang = isLocale(locale) ? LOCALES[locale].lang : "en";
  const research = loadResearch();
  return Object.fromEntries(
    checkupIndustries().flatMap((slug) => {
      const ind = industries.find((i) => i.slug === slug && i.live);
      const def = loadCheckupDef(slug);
      // The report needs the hub's sector facts and deadlines, so the check-up runs in a country the hub covers.
      const country = research.find((r) => r.industry === slug)?.country;
      return ind && def && country ? [[slug, { ...localizeDef(def, lang), name: pick(ind.name, locale), icon: ind.icon, country }]] : [];
    }),
  );
}
