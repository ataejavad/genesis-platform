"use client";

import { useRouter } from "next/navigation";

// Country filter inside an industry hub or the marketplace; the choice is remembered for next time.
export function CountrySwitch({ lang, label, current, options }: { lang: string; label: string; current: string; options: { code: string; flag: string; href: string }[] }) {
  const router = useRouter();
  const names = new Intl.DisplayNames([lang, "en"], { type: "region" });
  if (options.length < 2) {
    const only = options[0];
    return <span className="chip">{only.flag} {names.of(only.code)}</span>;
  }
  return (
    <label className="country-switch">
      <span className="small muted">{label}</span>
      <select
        value={current}
        onChange={(e) => {
          const next = options.find((o) => o.code === e.target.value)!;
          document.cookie = `country=${next.code}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
          router.push(next.href);
        }}
      >
        {options.map((o) => <option key={o.code} value={o.code}>{o.flag} {names.of(o.code)}</option>)}
      </select>
    </label>
  );
}
