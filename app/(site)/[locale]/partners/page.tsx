import type { Metadata } from "next";
import { Apply } from "./apply";

export const metadata: Metadata = { title: "همکاری با ما" };

const kinds = [
  { icon: "🧑‍💻", t: "فریلنسر و متخصص", d: "بازاریاب، توسعه‌دهنده n8n، طراح، مترجم، کارشناس صنعت." },
  { icon: "🏢", t: "شرکت تأمین‌کننده", d: "آژانس‌ها و شرکت‌های اجرایی که پروژه مشتری را تحویل می‌دهند." },
  { icon: "🤖", t: "ایجنت و نرم‌افزار", d: "سازندگان ایجنت و API که می‌خواهند در کاتالوگ ما باشند." },
];
const why = [
  "پروژه آماده: ما مشتری را پیدا می‌کنیم، شما فقط تحویل می‌دهید.",
  "معیار روشن: هر کار پروتکل و معیار قبولی دارد؛ می‌دانید چه چیزی خوب است.",
  "تسویه سریع: پرداخت حداکثر ۷ روز بعد از قبولی تحویل.",
  "رتبه و رشد: کیفیت بالاتر، رتبه بالاتر، پروژه‌های بیشتر و بهتر.",
];

export default function PartnersPage() {
  return (
    <main>
      <section className="wrap-site hero" style={{ paddingBottom: 24 }}>
        <div>
          <span className="badge ai" style={{ marginBottom: 14 }}>✦ پورتال همکاران</span>
          <h1>با ما برای <em>بهترین شرکت‌های اروپا</em> کار کنید</h1>
          <p className="lead">همه کار داخل یک پلتفرم: پروژه، پروتکل، پیام، تحویل و تسویه. شما روی تخصصتان تمرکز می‌کنید؛ فروش و هماهنگی با ماست.</p>
          <div className="stack">
            {why.map((w) => <div key={w} className="row"><span className="badge ok">✓</span><span>{w}</span></div>)}
          </div>
        </div>
        <div className="grid">
          {kinds.map((k) => (
            <div key={k.t} className="card row" style={{ alignItems: "flex-start" }}>
              <span style={{ fontSize: 28 }}>{k.icon}</span>
              <div><h3 style={{ marginBottom: 4 }}>{k.t}</h3><div className="muted small">{k.d}</div></div>
            </div>
          ))}
        </div>
      </section>
      <section className="wrap-site section" style={{ maxWidth: 820, paddingTop: 0 }}>
        <Apply />
      </section>
    </main>
  );
}
