"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; icon: string; count?: number };
export type NavGroup = { title?: string; items: NavItem[] };

const doors: NavItem[] = [
  { href: "/fa-ir", label: "سایت عمومی", icon: "🌐" },
  { href: "/portal", label: "پورتال مشتری", icon: "🏢" },
  { href: "/partner", label: "پورتال همکاران", icon: "🤝" },
  { href: "/cockpit", label: "کابین مدیریت", icon: "🧭" },
  { href: "/map", label: "نقشه همه صفحه‌ها", icon: "🗺️" },
];

export function Shell({
  brand,
  door,
  groups,
  user,
  demo = true,
  children,
}: {
  brand: string;
  door: string;
  groups: NavGroup[];
  user: { name: string; sub: string };
  demo?: boolean;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const isActive = (href: string) => path === href || (href.split("/").length > 2 && path.startsWith(href + "/"));
  return (
    <div className="shell">
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
          <div className="door">درهای پلتفرم</div>
          {doors.map((it) => (
            <Link key={it.href} href={it.href}>
              <span>{it.icon}</span>
              <span>{it.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <div className="main">
        {demo && <div className="demo-banner">نسخه نمایشی: داده‌های این صفحه نمونه‌اند و بعداً به پایگاه داده، n8n و ایجنت‌ها وصل می‌شوند.</div>}
        <header className="topbar">
          <input className="search" placeholder="جستجو در پروژه‌ها، کارها، شرکت‌ها… (به‌زودی با AI)" />
          <div className="user">
            <span className="badge ai">✦ دستیار AI</span>
            <div style={{ textAlign: "start", lineHeight: 1.3 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{user.name}</div>
              <div className="muted small">{user.sub}</div>
            </div>
            <span className="avatar">{user.name.slice(0, 1)}</span>
          </div>
        </header>
        <div className="content">{children}</div>
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
