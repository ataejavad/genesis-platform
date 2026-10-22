import { PageHead } from "@/ui/Shell";

const endpoints = [
  { m: "POST", p: "/api/v1/drafts", d: "ایجنت پیش‌نویس صفحه می‌فرستد (فعال، واقعی)", live: true },
  { m: "GET", p: "/api/v1/drafts/:id", d: "وضعیت تأیید یک پیش‌نویس (فعال، واقعی)", live: true },
  { m: "GET", p: "/api/v1/catalog", d: "کاتالوگ خدمات و قیمت برای ایجنت‌های خریدار (نمونه)", live: true },
  { m: "GET", p: "/llms.txt", d: "خلاصه ماشین‌خوان سایت برای AIها (فعال، واقعی)", live: true },
  { m: "POST", p: "/api/v1/leads", d: "شکارچی سرنخ شرکت تازه ثبت می‌کند", live: false },
  { m: "POST", p: "/api/v1/projects/:id/tasks", d: "ساخت کار برای همکار یا ایجنت", live: false },
  { m: "POST", p: "/api/v1/deliverables/:id/checks", d: "ایجنت QA نتیجه سنجش هر معیار را ثبت می‌کند", live: false },
  { m: "POST", p: "/api/v1/messages", d: "پیام با واسطه (پنهان‌سازی خودکار)", live: false },
  { m: "MCP", p: "mcp://legendpartner", d: "سرور MCP برای ایجنت‌های بیرونی", live: false },
];

export default function Api() {
  return (
    <main>
      <PageHead title="API و اتصال‌ها" crumbs="کابین › ماشین" sub="API-first: هر کاری که در صفحه‌ها می‌شود، یک API هم دارد؛ n8n، ایجنت‌ها و بعداً مشتری‌ها از همین‌ها استفاده می‌کنند." actions={<button className="btn primary">+ کلید API تازه</button>} />
      <div className="card table-wrap" style={{ marginBottom: 18 }}>
        <table className="table">
          <thead><tr><th>روش</th><th>مسیر</th><th>کار</th><th>وضعیت</th></tr></thead>
          <tbody>{endpoints.map((e) => (<tr key={e.p}><td><span className="badge">{e.m}</span></td><td className="ltr">{e.p}</td><td>{e.d}</td><td>{e.live ? <span className="badge ok">ساخته شد</span> : <span className="badge gray">برنامه‌ریزی‌شده</span>}</td></tr>))}</tbody>
        </table>
      </div>
      <div className="grid g3">
        <div className="card"><h3>n8n</h3><p className="muted small">هر رویداد سیستم (تأیید، انتشار، تحویل…) به وب‌هوک n8n فرستاده می‌شود.</p><span className="badge warn">آدرس وب‌هوک هنوز تنظیم نشده</span></div>
        <div className="card"><h3>تلگرام</h3><p className="muted small">درخواست‌های تأیید با دکمه به تلگرام تو می‌آید.</p><span className="badge warn">ربات هنوز ساخته نشده</span></div>
        <div className="card"><h3>Claude API</h3><p className="muted small">مغز ایجنت‌ها. کلید روی کامپیوتر تو در فایل ‎.env می‌نشیند، نه در چت.</p><span className="badge warn">منتظر کلید</span></div>
      </div>
    </main>
  );
}
