"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CommandBar } from "./CommandBar";

export type NavItem = { href: string; label: string; icon: string; count?: number };
export type NavGroup = { title?: string; items: NavItem[] };

const doorLinks = ["/fa-ir", "/portal", "/partner", "/cockpit", "/map"];
const doorIcons = ["🌐", "🏢", "🤝", "🧭", "🗺️"];
const text = {
  fa: {
    doors: ["سایت عمومی", "پورتال مشتری", "پورتال همکاران", "کابین مدیریت", "نقشه همه صفحه‌ها"],
    doorsTitle: "درهای پلتفرم",
    demo: "نسخه نمایشی: داده‌های این صفحه نمونه‌اند و بعداً به پایگاه داده، n8n و ایجنت‌ها وصل می‌شوند.",
    skip: "رفتن به محتوا",
  },
  en: {
    doors: ["Public site", "Customer portal", "Partner portal", "Cockpit", "Map of all pages"],
    doorsTitle: "Platform doors",
    demo: "Demo: sample data. Screens get wired to the database, n8n and agents during the build days.",
    skip: "Skip to content",
  },
};

export function Shell({
  brand,
  door,
  groups,
  user,
  demo = true,
  lang = "fa",
  children,
}: {
  brand: string;
  door: string;
  groups: NavGroup[];
  user: { name: string; sub: string };
  demo?: boolean;
  lang?: "fa" | "en";
  children: React.ReactNode;
}) {
  const path = usePathname();
  const isActive = (href: string) => path === href || (href.split("/").length > 2 && path.startsWith(href + "/"));
  const t = text[lang];
  return (
    <div className="shell" dir={lang === "en" ? "ltr" : "rtl"} lang={lang}>
      <a className="skip" href="#main">{t.skip}</a>
      <aside className="sidebar">
        <Link href="/map" className="brand" style={{ textDecoration: "none" }}>
          <span className="logo">L</span>
          <span>{brand}</span>
        </Link>
        <div className="door">{door}</div>
        {groups.map((g, i) => (
          <nav key={i}>
            {g.title && <div className="door">{g.title}</div>}
            {g.items.map((it) => (
              <Link key={it.href} href={it.href} className={isActive(it.href) ? "active" : ""}>
                <span>{it.icon}</span>
                <span>{it.label}</span>
                {it.count ? <span className="count">{it.count}</span> : null}
              </Link>
            ))}
          </nav>
        ))}
        <nav className="switch">
          <div className="door">{t.doorsTitle}</div>
          {doorLinks.map((href, i) => (
            <Link key={href} href={href}>
              <span>{doorIcons[i]}</span>
              <span>{t.doors[i]}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <div className="main">
        {demo && <div className="demo-banner">{t.demo}</div>}
        <header className="topbar">
          <CommandBar lang={lang} />
          <div className="user">
            <div style={{ textAlign: "start", lineHeight: 1.3 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{user.name}</div>
              <div className="muted small">{user.sub}</div>
            </div>
            <span className="avatar">{user.name.slice(0, 1)}</span>
          </div>
        </header>
        <div className="content" id="main">{children}</div>
      </div>
    </div>
  );
}

export function PageHead({ title, crumbs, sub, actions }: { title: string; crumbs?: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div>
        {crumbs && <div className="crumbs">{crumbs}</div>}
        <h1 style={{ margin: 0 }}>{title}</h1>
        {sub && <div className="muted">{sub}</div>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}
