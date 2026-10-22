"use client";

import Link from "next/link";
import { useState } from "react";

// Prototype of the contributor application. Later: POST /api/v1/applications, the screening agent
// scores the CV against the open roles and the application lands in cockpit → partners.
const skills = ["بازاریابی و محتوا", "اتوماسیون n8n / Make", "توسعه وب", "راه‌اندازی ایجنت AI", "طراحی", "ترجمه آلمانی/ایتالیایی", "فروش و تماس", "کارشناس صنعت"];

export function Apply() {
  const [sent, setSent] = useState(false);
  const [kind, setKind] = useState("فریلنسر");
  const [picked, setPicked] = useState<string[]>([]);
  if (sent) {
    return (
      <div className="card stack" style={{ padding: 28 }}>
        <span className="badge ok" style={{ justifySelf: "start" }}>✓ درخواست ثبت شد</span>
        <h2>ممنون! درخواست شما رسید.</h2>
        <div className="callout ai">✦ ایجنت بررسی، رزومه شما را با نقش‌های باز مقایسه می‌کند. حداکثر ۳ روز کاری خبر می‌دهیم و اگر مناسب باشد، یک کار آزمایشی کوتاه با پروتکل مشخص می‌فرستیم.</div>
        <div className="row"><Link className="btn primary" href="/partner">دیدن پورتال همکاران (نمونه)</Link></div>
      </div>
    );
  }
  return (
    <form className="card stack" style={{ padding: 28, gap: 14 }} onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
      <h2>درخواست همکاری</h2>
      <div className="row">
        {["فریلنسر", "شرکت", "ایجنت / نرم‌افزار"].map((k) => (
          <label key={k} className="choice"><input type="radio" name="kind" checked={kind === k} onChange={() => setKind(k)} /> {k}</label>
        ))}
      </div>
      <div className="grid g2">
        <label className="field">{kind === "شرکت" ? "نام شرکت" : "نام و نام خانوادگی"}<input required /></label>
        <label className="field">ایمیل<input type="email" required className="ltr" /></label>
        <label className="field">کشور محل کار<input required /></label>
        <label className="field">نرخ ساعتی یا ماهانه (یورو)<input inputMode="numeric" className="ltr" /></label>
      </div>
      <div className="field" style={{ display: "grid", gap: 6, fontWeight: 600, fontSize: 14 }}>
        تخصص‌ها
        <div className="row">
          {skills.map((s) => (
            <label key={s} className="choice" style={{ padding: "6px 10px" }}>
              <input type="checkbox" checked={picked.includes(s)} onChange={() => setPicked(picked.includes(s) ? picked.filter((x) => x !== s) : [...picked, s])} />
              <span className="small">{s}</span>
            </label>
          ))}
        </div>
      </div>
      <label className="field">لینک نمونه‌کار یا LinkedIn<input className="ltr" placeholder="https://" /></label>
      <label className="field">رزومه (PDF)<input type="file" accept="application/pdf" /><span className="hint">فقط برای بررسی همین درخواست استفاده می‌شود.</span></label>
      <label className="field">چرا با ما؟<textarea /></label>
      <label className="choice">
        <input type="checkbox" required />
        <span className="small">قبول دارم که همه ارتباط با مشتریان فقط داخل پلتفرم انجام می‌شود (white-label) و با سیاست حریم خصوصی موافقم.</span>
      </label>
      <div className="row"><span className="spacer" /><button className="btn primary lg">ارسال درخواست</button></div>
    </form>
  );
}
