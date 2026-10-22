import Link from "next/link";
import { BRAND } from "@/mock/data";

// Index of every door and screen of the prototype, so the founders can click through everything.
const doors = [
  {
    icon: "🌐", title: "سایت عمومی", who: "مشتریان، گوگل و ایجنت‌های خریدار", pages: [
      { href: "/fa-ir", t: "صفحه اصلی (فارسی)" },
      { href: "/de-de", t: "صفحه اصلی (آلمانی)" },
      { href: "/fa-ir/checkup", t: "چک‌آپ رایگان AI (پله ۱ نردبان)" },
      { href: "/fa-ir/partners", t: "همکاری با ما و فرم درخواست" },
    ],
  },
  {
    icon: "🏢", title: "پورتال مشتری", who: "شرکت مشتری (نمونه: Glas Becker GmbH)", pages: [
      { href: "/portal", t: "داشبورد" },
      { href: "/portal/projects", t: "پروژه‌ها" },
      { href: "/portal/projects/P-301", t: "یک پروژه (نمای white-label)" },
      { href: "/portal/services", t: "خدمات و نردبان رشد" },
      { href: "/portal/advisor", t: "مشاور AI اختصاصی" },
      { href: "/portal/reports", t: "گزارش‌های ماهانه" },
      { href: "/portal/invoices", t: "فاکتورها" },
      { href: "/portal/company", t: "پروفایل و داده شرکت" },
    ],
  },
  {
    icon: "🤝", title: "پورتال همکاران", who: "فریلنسرها، تأمین‌کننده‌ها، ایجنت‌ها (نمونه: Marco Rossi)", pages: [
      { href: "/partner", t: "داشبورد همکار" },
      { href: "/partner/tasks", t: "کارهای من" },
      { href: "/partner/projects/P-302", t: "پروژه: بریف، پروتکل، تحویل، پیام" },
      { href: "/partner/profile", t: "پروفایل، رزومه و خدمات" },
      { href: "/partner/earnings", t: "درآمد و تسویه" },
    ],
  },
  {
    icon: "🧭", title: "کابین مدیریت", who: "جواد و Claude (ورود لازم است)", pages: [
      { href: "/cockpit", t: "نمای کلی شرکت" },
      { href: "/cockpit/approvals", t: "صف تأیید (واقعی، به پایگاه داده وصل است)" },
      { href: "/cockpit/markets", t: "بازارها و فیلترهای Genesis" },
      { href: "/cockpit/leads", t: "سرنخ‌ها و مشتری‌ها" },
      { href: "/cockpit/contracts", t: "کارخانه قرارداد" },
      { href: "/cockpit/projects", t: "پروژه‌ها و کارها" },
      { href: "/cockpit/projects/P-302", t: "یک پروژه (کانبان)" },
      { href: "/cockpit/partners", t: "همکاران و درخواست‌ها" },
      { href: "/cockpit/protocols", t: "کتابخانه پروتکل‌ها" },
      { href: "/cockpit/protocols/PR-01", t: "یک پروتکل با معیارها" },
      { href: "/cockpit/qa", t: "سنجش تحویل (QA)" },
      { href: "/cockpit/moderation", t: "نظارت پیام‌ها" },
      { href: "/cockpit/agents", t: "ایجنت‌ها" },
      { href: "/cockpit/api", t: "API و اتصال‌ها (n8n، تلگرام)" },
    ],
  },
  {
    icon: "🤖", title: "لایه ایجنت‌ها", who: "ایجنت‌های خریدار، موتورهای جست‌وجو، n8n", pages: [
      { href: "/llms.txt", t: "llms.txt" },
      { href: "/api/v1/catalog", t: "کاتالوگ خدمات (JSON)" },
      { href: "/sitemap.xml", t: "sitemap.xml" },
      { href: "/api/health", t: "سلامت سیستم" },
    ],
  },
];

export default function MapPage() {
  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 20px 64px" }}>
      <div className="row" style={{ marginBottom: 8 }}>
        <span className="logo">L</span>
        <h1 style={{ margin: 0 }}>{BRAND}: نقشه همه صفحه‌ها</h1>
      </div>
      <p className="muted">یک اپ، پنج در. همه صفحه‌ها قابل کلیک‌اند؛ داده‌ها نمونه‌اند مگر جایی که «واقعی» نوشته شده. برای کابین: <span className="ltr">admin@local.test</span> / <span className="ltr">local-demo-password</span></p>
      <div className="grid g2" style={{ marginTop: 20 }}>
        {doors.map((d) => (
          <div key={d.title} className="card">
            <div className="card-head">
              <span style={{ fontSize: 26 }}>{d.icon}</span>
              <div><h3>{d.title}</h3><div className="muted small">{d.who}</div></div>
            </div>
            <div className="list">
              {d.pages.map((p) => (
                <div key={p.href} className="item">
                  <Link className="grow" href={p.href}>{p.t}</Link>
                  <span className="muted small ltr">{p.href}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
