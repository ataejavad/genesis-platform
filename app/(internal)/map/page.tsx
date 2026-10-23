import Link from "next/link";
import { BRAND } from "@/mock/data";

// Index of every door and screen of the prototype, so the founders can click through everything.
const doors = [
  {
    icon: "🌐", title: "سایت عمومی (۴ زبان)", who: "مشتریان، گوگل و ایجنت‌های خریدار", pages: [
      { href: "/fa-ir", t: "صفحه اصلی با چت معرف و محتوای زنده" },
      { href: "/fa-ir?as=glas-becker", t: "صفحه اصلی وقتی مشتری وارد شده (شخصی‌شده)" },
      { href: "/de-de", t: "همان صفحه به آلمانی" },
      { href: "/it-it", t: "همان صفحه به ایتالیایی" },
      { href: "/fa-ir/signup", t: "ثبت‌نام شرکت (ایجنت صنعت را پیدا می‌کند)" },
      { href: "/fa-ir/explore", t: "کاوش همه صنایع (بخش › زیرصنعت › کشور)" },
      { href: "/fa-ir/hub/glass", t: "یک هاب صنعت: شیشه (کشور داخل هاب انتخاب می‌شود)" },
      { href: "/fa-ir/market?industry=glass", t: "بازار راه‌حل‌های تخصصی" },
      { href: "/fa-ir/market/quote-agent", t: "صفحه محصول + سفارش" },
      { href: "/fa-ir/company/fensterbau-mueller", t: "صفحه عمومی یک شرکت (دایرکتوری)" },
      { href: "/fa-ir/checkup", t: "چک‌آپ رایگان (ایجنت گفتگومحور)" },
      { href: "/fa-ir/tools", t: "ابزارهای رایگان" },
      { href: "/fa-ir/about", t: "درباره ما (چشم‌انداز عمومی)" },
      { href: "/fa-ir/partners", t: "همکاری با ما" },
      { href: "/fa-ir/legal", t: "اطلاعات حقوقی و حریم خصوصی" },
    ],
  },
  {
    icon: "🏢", title: "داشبورد مشتری (۱۰ بخش)", who: "شرکت مشتری (نمونه: Glas Becker GmbH)", pages: [
      { href: "/portal", t: "خانه: ROI، تأییدها، بینش‌ها، شروع کار، مقایسه با هم‌صنف‌ها" },
      { href: "/portal/advisor", t: "مشاور AI" },
      { href: "/portal/projects", t: "پروژه‌ها" },
      { href: "/portal/apps", t: "اپ‌های من" },
      { href: "/portal/apps/quote", t: "یک اپ بومی: ایجنت قیمت‌دهی" },
      { href: "/portal/services", t: "نردبان رشد" },
      { href: "/portal/reports", t: "گزارش‌ها" },
      { href: "/portal/inbox", t: "پیام و پشتیبانی" },
      { href: "/portal/billing", t: "قرارداد و فاکتور" },
      { href: "/portal/data", t: "داده من" },
      { href: "/portal/settings", t: "تنظیمات، تیم و گزارش فعالیت" },
    ],
  },
  {
    icon: "🤝", title: "پورتال همکاران (۱۱ بخش)", who: "فریلنسرها، تأمین‌کننده‌ها، همکاران داخلی (نمونه: Marco Rossi)", pages: [
      { href: "/partner", t: "خانه: کار بعدی" },
      { href: "/partner/jobs", t: "صندوق کار (تطبیق با AI)" },
      { href: "/partner/tasks", t: "پروژه‌ها و کارها" },
      { href: "/partner/projects/P-302", t: "تحویل با خودسنجی AI" },
      { href: "/partner/protocols", t: "پروتکل‌ها" },
      { href: "/partner/messages", t: "پیام‌ها (با واسطه)" },
      { href: "/partner/services", t: "خدمات و ظرفیت" },
      { href: "/partner/rank", t: "رتبه و سطح" },
      { href: "/partner/earnings", t: "درآمد و تسویه" },
      { href: "/partner/profile", t: "پروفایل و گاوصندوق مدارک" },
      { href: "/partner/learn", t: "یادگیری" },
      { href: "/partner/goals", t: "اهداف و KPI (همکار داخلی)" },
    ],
  },
  {
    icon: "🧭", title: "کابین (انگلیسی)", who: "جواد (ورود لازم است)", pages: [
      { href: "/cockpit", t: "Today: خلاصه روزانه، تأییدها، هشدارها" },
      { href: "/cockpit/approvals", t: "Approvals (بخش محتوا واقعی است)" },
      { href: "/cockpit/agents", t: "Agent center + نقشه زنده" },
      { href: "/cockpit/markets", t: "Markets & hubs" },
      { href: "/cockpit/crm", t: "CRM & personas" },
      { href: "/cockpit/crm/glastec-nord", t: "یک پرسونا" },
      { href: "/cockpit/catalog", t: "Marketplace catalogue" },
      { href: "/cockpit/projects", t: "Projects" },
      { href: "/cockpit/projects/P-301", t: "یک پروژه: مایلستون، تغییر، هزینه" },
      { href: "/cockpit/partners", t: "Partners" },
      { href: "/cockpit/protocols", t: "Protocol library" },
      { href: "/cockpit/protocols/PR-01", t: "یک کارت پروتکل" },
      { href: "/cockpit/qa", t: "QA queue" },
      { href: "/cockpit/moderation", t: "Moderation" },
      { href: "/cockpit/contracts", t: "Contracts (یک‌کلیکی) + بسته کشور" },
      { href: "/cockpit/finance", t: "Finance" },
      { href: "/cockpit/api", t: "API & connections" },
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
