"use client";

import { useState } from "react";

// "Ask or do anything" bar on every portal screen (doc 15 §6و). Prototype: canned answers by keyword.
const answers = {
  fa: [
    { k: /فاکتور|invoice|پرداخت/, a: "آخرین فاکتور LP-2026-0052 (€1,190) منتظر پرداخت است. در «قرارداد و فاکتور» بازش کنید." },
    { k: /تماس|call|تلفن/, a: "ایجنت تلفن این ماه ۳۱۲ تماس را پاسخ داد (۹۷٪). جزئیات در «اپ‌های من › پاسخ‌گوی تلفن»." },
    { k: /.*/, a: "انجام شد: درخواست شما برای تیم ثبت شد و در «صندوق پیام» پیگیری می‌شود. (نسخه نمایشی)" },
  ],
  en: [
    { k: /approve|pending/i, a: "3 items wait for you: 20 personalised emails, 1 QA delivery, 1 contract. Open Approvals." },
    { k: /cost|budget|spend/i, a: "AI spend this month: €19.30 of €150 budget (13%). Highest: Lead hunter €6.80." },
    { k: /.*/, a: "Done (demo): I logged this as a task for the orchestrator. You will see it in Projects." },
  ],
};

export function CommandBar({ lang }: { lang: "fa" | "en" }) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const run = () => q.trim() && setAnswer(answers[lang].find((x) => x.k.test(q))!.a);
  return (
    <div className="cmd">
      <span className="spark" aria-hidden>✦</span>
      <label className="sr-only" htmlFor="cmd">{lang === "fa" ? "از AI بپرسید یا کاری بخواهید" : "Ask AI or tell it what to do"}</label>
      <input
        id="cmd"
        value={q}
        onChange={(e) => { setQ(e.target.value); setAnswer(""); }}
        onKeyDown={(e) => e.key === "Enter" && run()}
        placeholder={lang === "fa" ? "بپرس یا بگو انجام بدهد… (Enter)" : "Ask or do anything… (Enter)"}
      />
      {answer && <div className="drop fade-in" role="status"><b>✦ AI</b> · {answer}</div>}
    </div>
  );
}
