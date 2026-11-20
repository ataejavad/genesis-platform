"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { LANG_NAMES, PORTAL_LANGS } from "@/config/portal-copy";
import { authClient } from "@/lib/auth-client";

export type ShellNav = { href: string; label: string; icon: string; count?: number };

/** Shell of the outside doors (customer dashboard, partner portal): multilingual, no links to internal doors. */
export function AppShell({ door, nav, brand, company, user, banner, lang, langLabel, setLanguage, loginPath, children }: {
  door: string; nav: ShellNav[]; brand: string; company: string; user: string; banner?: string | null; lang: string; langLabel: string;
  setLanguage: (lang: string) => Promise<void>; loginPath: string; children: React.ReactNode;
}) {
  const path = usePathname();
  const [pending, start] = useTransition();
  const home = nav[0]?.href;
  const active = (href: string) => (href === home ? path === href : path.startsWith(href));
  return (
    <div className="shell">
      <a className="skip" href="#main">Skip to content</a>
      <aside className="sidebar">
        <div className="brand"><span className="logo">L</span><span>{brand}</span></div>
        <div className="door">{door}</div>
        <nav>
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={active(n.href) ? "active" : ""} aria-current={active(n.href) ? "page" : undefined}>
              <span>{n.icon}</span><span>{n.label}</span>{n.count ? <span className="count">{n.count}</span> : null}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="main">
        {banner && <div className="demo-banner">{banner}</div>}
        <header className="topbar">
          <b>{company}</b>
          <div className="user">
            <label className="lang-switch"><span aria-hidden>🌐</span><span className="sr-only">{langLabel}</span>
              <select value={lang} disabled={pending} onChange={(e) => start(() => setLanguage(e.target.value))}>
                {PORTAL_LANGS.map((l) => <option key={l} value={l}>{LANG_NAMES[l]}</option>)}
              </select>
            </label>
            <span className="small">{user}</span>
            <span className="avatar">{user.slice(0, 1)}</span>
            <button className="btn sm" onClick={async () => { await authClient.signOut(); window.location.href = loginPath; }} aria-label="Sign out">⎋</button>
          </div>
        </header>
        <div className="content" id="main">{children}</div>
      </div>
    </div>
  );
}
