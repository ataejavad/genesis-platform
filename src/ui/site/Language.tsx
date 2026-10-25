"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LOCALE_COOKIE, LOCALES, matchLocale, type Locale } from "@/config/locales";

const YEAR = 60 * 60 * 24 * 365;
const DISMISS_KEY = "lang-suggest-dismissed";

function remember(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${YEAR}; samesite=lax`;
}

// Same page in another locale: /de-de/hub/x → /it-it/hub/x.
function swapLocale(path: string, from: Locale, to: Locale) {
  return path === `/${from}` || path.startsWith(`/${from}/`) ? `/${to}${path.slice(from.length + 1)}` : `/${to}`;
}

// Header select; names are in their own script, no flags (a flag is a country, not a language).
export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const path = usePathname();
  return (
    <label className="lang-switch">
      <span className="sr-only">Language</span>
      <span aria-hidden="true">🌐</span>
      <select
        value={locale}
        onChange={(e) => {
          const to = e.target.value as Locale;
          remember(to);
          router.push(swapLocale(path, locale, to));
        }}
      >
        {(Object.keys(LOCALES) as Locale[]).map((code) => (
          <option key={code} value={code} lang={LOCALES[code].lang}>{LOCALES[code].label}</option>
        ))}
      </select>
    </label>
  );
}

const ASK: Record<string, { q: string; yes: string; no: string }> = {
  en: { q: "View this site in English?", yes: "Switch", no: "Stay" },
  de: { q: "Diese Seite auf Deutsch ansehen?", yes: "Wechseln", no: "Bleiben" },
  it: { q: "Vedere questo sito in italiano?", yes: "Cambia", no: "Resta" },
  fa: { q: "این سایت را به فارسی می‌بینید؟", yes: "تغییر", no: "بمان" },
};

// Suggests (never forces) the browser's language when the visitor landed on another one, e.g. from a shared link.
export function LanguageSuggest({ locale }: { locale: Locale }) {
  const router = useRouter();
  const path = usePathname();
  const [target, setTarget] = useState<Locale | null>(null);

  useEffect(() => {
    try {
      if (document.cookie.includes(`${LOCALE_COOKIE}=`) || localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      return;
    }
    const best = matchLocale(navigator.languages.join(","));
    if (best && best !== locale) setTarget(best);
  }, [locale]);

  if (!target) return null;
  const t = ASK[LOCALES[target].lang] ?? ASK.en;
  return (
    <div className="lang-suggest" role="region" aria-label="Language" lang={LOCALES[target].lang} dir={LOCALES[target].dir}>
      <span>{t.q}</span>
      <button className="btn primary sm" onClick={() => { remember(target); router.push(swapLocale(path, locale, target)); setTarget(null); }}>{t.yes}</button>
      <button className="btn sm" onClick={() => { remember(locale); try { localStorage.setItem(DISMISS_KEY, "1"); } catch {} setTarget(null); }}>{t.no}</button>
    </div>
  );
}
