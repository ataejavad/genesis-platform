"use client";

import { useState } from "react";

const canned = [
  "بر اساس داده‌های ۳ ماه اخیر، بیشترین وقت تیم شما صرف پیگیری پیشنهادهای قیمت بی‌جواب می‌شود. ایجنت پیگیری خودکار می‌تواند ۳ و ۷ روز بعد پیام بفرستد.",
  "این کار در پله ۲ (راه‌حل آماده) است و حدود €190 در ماه هزینه دارد. می‌خواهید درخواستش را برای تیم ما بفرستم؟",
  "درخواست ثبت شد. تیم ما تا ۲ روز کاری پیشنهاد دقیق را در «پروژه‌ها» می‌گذارد.",
];

export function AdvisorChat() {
  const [items, setItems] = useState<{ from: string; text: string }[]>([
    { from: "them", text: "سلام! من مشاور AI اختصاصی Glas Becker هستم. درباره عملکرد خدمات، ایده‌های تازه یا هر مشکلی بپرسید." },
  ]);
  const [text, setText] = useState("");
  const send = () => {
    if (!text.trim()) return;
    const reply = canned[Math.min(canned.length - 1, items.filter((i) => i.from === "me").length)];
    setItems((all) => [...all, { from: "me", text }, { from: "them", text: reply }]);
    setText("");
  };
  return (
    <div className="card" style={{ maxWidth: 820 }}>
      <div className="chat" style={{ minHeight: 300 }}>
        {items.map((m, i) => (
          <div key={i} className={`msg ${m.from}`}><div className="who">{m.from === "me" ? "شما" : "✦ مشاور AI"}</div>{m.text}</div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="مثلاً: کجا هنوز وقت تلف می‌کنیم؟" style={{ flex: 1 }} />
        <button className="btn primary" onClick={send}>ارسال</button>
      </div>
    </div>
  );
}
