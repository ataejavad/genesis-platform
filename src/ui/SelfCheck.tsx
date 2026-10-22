"use client";

import { useState } from "react";

// Pre-QA self-check (doc 15 §6د۲ agent 6): the partner's copilot scores the draft against the protocol before submit.
export function SelfCheck({ criteria }: { criteria: { t: string; must: boolean }[] }) {
  const [ran, setRan] = useState(false);
  const [sent, setSent] = useState(false);
  const result = criteria.map((c, i) => ({ ...c, ok: i !== 4 && i !== 5 }));
  return (
    <div className="card stack">
      <h3>📤 تحویل کار</h3>
      <label className="field">فایل‌ها<input type="file" multiple /></label>
      <label className="field">توضیح برای سنجش<textarea placeholder="چه کردید و کجا را ببینیم؟" /></label>
      <button className="btn" onClick={() => setRan(true)}>✦ خودسنجی AI با پروتکل</button>
      {ran && (
        <div className="fade-in">
          {result.map((c) => <div key={c.t} className="row small" style={{ padding: "4px 0" }}><span>{c.ok ? "✅" : "⚠️"}</span><span style={{ flex: 1 }}>{c.t}</span>{c.must && <span className="badge bad">اجباری</span>}</div>)}
          <div className="callout warn small" style={{ marginTop: 8 }}>۲ معیار غیراجباری هنوز پوشش داده نشده. می‌توانید کامل کنید یا با توضیح بفرستید.</div>
        </div>
      )}
      {sent ? <span className="badge ok" style={{ justifySelf: "start" }}>✓ فرستاده شد: داور QA ← تأیید ما ← تأیید مشتری ← پرداخت</span> : <button className="btn primary" onClick={() => setSent(true)}>ارسال برای سنجش</button>}
    </div>
  );
}
