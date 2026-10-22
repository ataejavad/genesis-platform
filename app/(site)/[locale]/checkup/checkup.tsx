"use client";

import Link from "next/link";
import { useState } from "react";
import { industries } from "@/mock/data";

// Prototype of the free check-up (ladder step 1). Later: answers go to POST /api/v1/checkups,
// the check-up agent scores them and n8n sends the report; here the score is computed in the browser.
const sizes = ["۱ تا ۵ نفر", "۶ تا ۲۰ نفر", "۲۱ تا ۵۰ نفر", "۵۱ تا ۲۵۰ نفر"];
const countries = ["آلمان", "ایتالیا", "بریتانیا", "اتریش", "سوئیس", "کشور دیگر"];
const pains = [
  { id: "calls", t: "تماس‌ها و ایمیل‌های بی‌پاسخ", save: 14, op: "پاسخ‌گوی ۲۴ ساعته تلفن و ایمیل" },
  { id: "quotes", t: "قیمت‌دهی و پیش‌فاکتور کند", save: 12, op: "ایجنت پیش‌فاکتور خودکار" },
  { id: "followup", t: "پیگیری مشتری و یادآوری", save: 8, op: "پیگیری و یادآوری خودکار مشتری" },
  { id: "invoices", t: "ورود فاکتور و کارهای حسابداری", save: 10, op: "ورود خودکار فاکتورها به حسابداری" },
  { id: "schedule", t: "زمان‌بندی بازدید و نوبت", save: 9, op: "نوبت‌دهی هوشمند" },
  { id: "marketing", t: "بازاریابی و پیدا کردن مشتری", save: 7, op: "ایجنت محتوا و سرنخ‌یابی" },
];
const tools = ["ایمیل و اکسل", "CRM (مثل HubSpot)", "نرم‌افزار حسابداری (DATEV، …)", "سیستم نوبت‌دهی", "هیچ‌کدام"];

export function Checkup() {
  const [step, setStep] = useState(0);
  const [industry, setIndustry] = useState("");
  const [size, setSize] = useState("");
  const [country, setCountry] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [used, setUsed] = useState<string[]>([]);
  const [contact, setContact] = useState({ name: "", company: "", email: "", consent: false });

  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const can = [!!industry, !!size && !!country, picked.length > 0, used.length > 0, !!contact.email && contact.consent][step];
  const total = 5;

  if (step === total) {
    const chosen = pains.filter((p) => picked.includes(p.id));
    const hours = chosen.reduce((s, p) => s + p.save, 0) * (sizes.indexOf(size) + 1);
    const score = Math.min(92, 38 + chosen.length * 7 + (used.includes("هیچ‌کدام") ? 0 : used.length * 4));
    return (
      <div className="stack" style={{ gap: 18 }}>
        <span className="badge ok" style={{ justifySelf: "start" }}>✓ چک‌آپ کامل شد</span>
        <h1>نتیجه چک‌آپ {contact.company || "شرکت شما"}</h1>
        <div className="card row" style={{ gap: 28 }}>
          <div style={{ display: "grid", justifyItems: "center", gap: 6 }}>
            <div className="ring" style={{ ["--p" as string]: score }}><div>{score}</div></div>
            <div className="muted small">امتیاز آمادگی AI از ۱۰۰</div>
          </div>
          <div className="stack" style={{ flex: 1 }}>
            <div className="muted small">صرفه‌جویی تخمینی</div>
            <div style={{ fontSize: 32, fontWeight: 800 }} className="num">{hours} ساعت در ماه</div>
            <div className="muted small">≈ €{(hours * 38).toLocaleString("en-US")} در ماه با نرخ ساعتی €۳۸ ({industries.find((i) => i.slug === industry)?.name}، {country})</div>
          </div>
        </div>
        <div className="card">
          <h3>سه فرصت اول شما</h3>
          <div className="list">
            {chosen.slice(0, 3).map((p, i) => (
              <div key={p.id} className="item">
                <span className="badge">{i + 1}</span>
                <div className="grow"><b>{p.op}</b><div className="muted small">برای «{p.t}» · حدود {p.save * (sizes.indexOf(size) + 1)} ساعت در ماه</div></div>
                <span className="badge gray">پله ۲</span>
              </div>
            ))}
          </div>
        </div>
        <div className="callout ai">✦ گزارش کامل PDF به <span className="ltr">{contact.email}</span> فرستاده می‌شود و مشاور AI شما در پورتال منتظر است تا قدم بعد را با هم بچینید.</div>
        <div className="row">
          <Link className="btn primary lg" href="/portal">ورود به پورتال و دیدن پیشنهاد</Link>
          <button className="btn lg" onClick={() => setStep(0)}>چک‌آپ دوباره</button>
        </div>
        <p className="muted small">نسخه نمایشی: در نسخه واقعی ایجنت چک‌آپ پاسخ‌ها را تحلیل می‌کند، n8n گزارش را می‌فرستد و سرنخ در کابین مدیریت ثبت می‌شود.</p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 28 }}>
      <div className="steps">{Array.from({ length: total }, (_, i) => <span key={i} className={i <= step ? "on" : ""} />)}</div>
      <div className="muted small" style={{ marginBottom: 6 }}>قدم {step + 1} از {total} · حدود ۳ دقیقه</div>

      {step === 0 && (
        <>
          <h2>شرکت شما در چه صنعتی کار می‌کند؟</h2>
          <div className="grid g2">
            {industries.map((i) => (
              <label key={i.slug} className="choice">
                <input type="radio" name="industry" checked={industry === i.slug} onChange={() => setIndustry(i.slug)} />
                <span style={{ fontSize: 22 }}>{i.icon}</span> {i.name}
              </label>
            ))}
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <h2>چند نفرید و کجا کار می‌کنید؟</h2>
          <div className="grid g2">
            {sizes.map((s) => (
              <label key={s} className="choice"><input type="radio" name="size" checked={size === s} onChange={() => setSize(s)} /> {s}</label>
            ))}
          </div>
          <label className="field" style={{ marginTop: 16 }}>
            کشور
            <select value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">انتخاب کنید</option>
              {countries.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        </>
      )}

      {step === 2 && (
        <>
          <h2>بیشترین وقت شما کجا هدر می‌رود؟</h2>
          <p className="muted">هر چند مورد که درست است را انتخاب کنید.</p>
          <div className="grid g2">
            {pains.map((p) => (
              <label key={p.id} className="choice"><input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(picked, setPicked, p.id)} /> {p.t}</label>
            ))}
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <h2>الان با چه ابزارهایی کار می‌کنید؟</h2>
          <div className="grid g2">
            {tools.map((t) => (
              <label key={t} className="choice"><input type="checkbox" checked={used.includes(t)} onChange={() => toggle(used, setUsed, t)} /> {t}</label>
            ))}
          </div>
        </>
      )}

      {step === 4 && (
        <>
          <h2>نتیجه را کجا بفرستیم؟</h2>
          <div className="grid g2">
            <label className="field">نام شما<input value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} /></label>
            <label className="field">نام شرکت<input value={contact.company} onChange={(e) => setContact({ ...contact, company: e.target.value })} /></label>
          </div>
          <label className="field" style={{ marginTop: 12 }}>ایمیل کاری<input type="email" className="ltr" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></label>
          <label className="choice" style={{ marginTop: 12 }}>
            <input type="checkbox" checked={contact.consent} onChange={(e) => setContact({ ...contact, consent: e.target.checked })} />
            <span className="small">موافقم پاسخ‌هایم برای ساخت گزارش و تماس درباره آن پردازش شود (سیاست حریم خصوصی، داده در اتحادیه اروپا).</span>
          </label>
        </>
      )}

      <div className="row" style={{ marginTop: 22 }}>
        {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>قبلی</button>}
        <span className="spacer" />
        <button className="btn primary" disabled={!can} style={{ opacity: can ? 1 : 0.5 }} onClick={() => setStep(step + 1)}>
          {step === total - 1 ? "دیدن نتیجه" : "بعدی"}
        </button>
      </div>
    </div>
  );
}
