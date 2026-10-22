"use client";

import { useState } from "react";
import { contractTypes } from "@/mock/data";

export function ContractFactory() {
  const [type, setType] = useState(contractTypes[0].key);
  const [draft, setDraft] = useState<string | null>(null);
  const t = contractTypes.find((c) => c.key === type)!;

  function generate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const lines = t.fields.map((f) => `- ${f}: ${data[f] || "…"}`).join("\n");
    setDraft(
      `${t.title}\n\nبین Legend Partner و طرف مقابل\n\n${lines}\n\n۱. موضوع قرارداد …\n۲. تعهدات طرفین …\n۳. محرمانگی و حفاظت داده (DPA پیوست) …\n` +
        (type === "supplier" ? "۴. عدم دور زدن و عدم جذب مستقیم مشتری (۲۴ ماه) …\n۵. وایت‌لیبل: همکار هویت خود را به مشتری فاش نمی‌کند …\n" : "") +
        (type === "customer" ? "۴. هزینه ماهانه و نتیجه‌محور بودن خدمات …\n۵. پیمانکاران فرعی تأییدشده در اتحادیه اروپا …\n" : "") +
        "\n(پیش‌نویس نمایشی؛ در نسخه واقعی، ایجنت قرارداد از قالب نسخه‌دار بازبینی‌شده توسط وکیل می‌سازد.)",
    );
  }

  return (
    <div className="grid g2">
      <form className="card stack" onSubmit={generate}>
        <h3>۱. اطلاعات پایه</h3>
        <label className="field">نوع قرارداد
          <select value={type} onChange={(e) => { setType(e.target.value); setDraft(null); }}>
            {contractTypes.map((c) => <option key={c.key} value={c.key}>{c.title}</option>)}
          </select>
        </label>
        {t.fields.map((f) => (
          <label key={f} className="field">{f}<input name={f} /></label>
        ))}
        {(type === "freelancer" || type === "employee") && (
          <div className="callout warn small">برای همکار داخلی، چند سؤال (ساعت کاری ثابت؟ فقط برای ما؟ دستور روزانه؟) تعیین می‌کند فریلنسر درست است یا قرارداد کار، تا خطر خوداشتغالی صوری نباشد.</div>
        )}
        <button className="btn primary">✦ ساخت قرارداد</button>
      </form>
      <div className="card stack">
        <h3>۲. پیش‌نویس، ویرایش و امضا</h3>
        {draft ? (
          <>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} style={{ minHeight: 320 }} />
            <div className="row"><button className="btn ok">تأیید و ارسال برای امضا</button><button className="btn">دانلود Word</button></div>
          </>
        ) : (
          <div className="empty">فرم را پر کن و «ساخت قرارداد» را بزن.</div>
        )}
      </div>
    </div>
  );
}
