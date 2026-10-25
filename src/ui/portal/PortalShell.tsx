"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { LANG_NAMES, PORTAL_LANGS, type PortalCopy } from "@/config/portal-copy";
import { authClient } from "@/lib/auth-client";
import { setLanguage } from "./actions";

const NAV = [
  ["/portal", "home", "💬"],
  ["/portal/results", "results", "📈"],
  ["/portal/services", "services", "✅"],
  ["/portal/requests", "requests", "📨"],
  ["/portal/billing", "billing", "🧾"],
  ["/portal/data", "data", "🗂️"],
  ["/portal/settings", "settings", "⚙️"],
] as const;

export function PortalShell({ t, lang, brand, company, user, counts, viewingAs, children }: {
  t: PortalCopy; lang: string; brand: string; company: string; user: string; counts: Partial<Record<(typeof NAV)[number][1], number>>; viewingAs: boolean; children: React.ReactNode;
}) {
  const path = usePathname();
  const [pending, start] = useTransition();
  const active = (href: string) => (href === "/portal" ? path === href : path.startsWith(href));
  return (
    <div className="shell">
      <a className="skip" href="#main">Skip to content</a>
      <aside className="sidebar">
        <div className="brand"><span className="logo">L</span><span>{brand}</span></div>
        <div className="door">{t.door}</div>
        <nav>
          {NAV.map(([href, key, icon]) => (
            <Link key={href} href={href} className={active(href) ? "active" : ""} aria-current={active(href) ? "page" : undefined}>
              <span>{icon}</span><span>{t.nav[key]}</span>{counts[key] ? <span className="count">{counts[key]}</span> : null}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="main">
        {viewingAs && <div className="demo-banner">{t.viewingAs.replace("{company}", company)}</div>}
        <header className="topbar">
          <b>{company}</b>
          <div className="user">
            <label className="lang-switch"><span aria-hidden>🌐</span><span className="sr-only">{t.page.settings.lang}</span>
              <select value={lang} disabled={pending} onChange={(e) => start(() => setLanguage(e.target.value))}>
                {PORTAL_LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
              </select>
            </label>
            <span className="small">{user}</span>
            <span className="avatar">{user.slice(0, 1)}</span>
            <button className="btn sm" onClick={async () => { await authClient.signOut(); window.location.href = "/portal/login"; }} aria-label="Sign out">⎋</button>
          </div>
        </header>
        <div className="content" id="main">{children}</div>
      </div>
    </div>
  );
}
