"use client";

import Link from "next/link";
import { useState } from "react";

// Free check-up as an adaptive diagnostic agent (doc 15 §6ه.6). Prototype: a scripted decision tree.
// Real version: Claude with the catalogue + APQC process map, prefill from public data, CRM write via API.
type T = { fa: string; en: string };
type Opt = { id: string; t: T };
type Q = { id: string; ask: T; opts: Opt[] };

const area: Q = {
  id: "area",
  ask: { fa: "تیم شما بیشترین وقت را کجا از دست می‌دهد؟", en: "Where does your team lose the most time?" },
  opts: [
    { id: "quotes", t: { fa: "فروش و قیمت‌دهی", en: "Sales & quoting" } },
    { id: "calls", t: { fa: "تلفن و پاسخ به مشتری", en: "Phone & customer replies" } },
    { id: "admin", t: { fa: "فاکتور و کارهای اداری", en: "Invoices & admin" } },
  ],
};
const branch: Record<string, Q[]> = {
  quotes: [
    { id: "volume", ask: { fa: "هفته‌ای چند درخواست قیمت می‌گیرید؟", en: "How many quote requests a week?" }, opts: [{ id: "1", t: { fa: "کمتر از ۱۰", en: "Under 10" } }, { id: "2", t: { fa: "۱۰ تا ۳۰", en: "10–30" } }, { id: "3", t: { fa: "بیشتر از ۳۰", en: "Over 30" } }] },
    { id: "speed", ask: { fa: "هر قیمت معمولاً چقدر طول می‌کشد؟", en: "How long does a quote usually take?" }, opts: [{ id: "1", t: { fa: "همان روز", en: "Same day" } }, { id: "2", t: { fa: "۱ تا ۲ روز", en: "1–2 days" } }, { id: "3", t: { fa: "۳ روز یا بیشتر", en: "3+ days" } }] },
    { id: "follow", ask: { fa: "پیشنهادهای بی‌جواب را پیگیری می‌کنید؟", en: "Do you follow up silent quotes?" }, opts: [{ id: "3", t: { fa: "نه", en: "No" } }, { id: "2", t: { fa: "گاهی", en: "Sometimes" } }, { id: "1", t: { fa: "همیشه", en: "Always" } }] },
  ],
  calls: [
    { id: "volume", ask: { fa: "روزی چند تماس دارید؟", en: "How many calls a day?" }, opts: [{ id: "1", t: { fa: "کمتر از ۱۵", en: "Under 15" } }, { id: "2", t: { fa: "۱۵ تا ۵۰", en: "15–50" } }, { id: "3", t: { fa: "بیشتر از ۵۰", en: "Over 50" } }] },
    { id: "missed", ask: { fa: "چند درصد تماس‌ها بی‌پاسخ می‌ماند؟", en: "What share of calls go unanswered?" }, opts: [{ id: "1", t: { fa: "کمتر از ۱۰٪", en: "Under 10%" } }, { id: "2", t: { fa: "۱۰ تا ۳۰٪", en: "10–30%" } }, { id: "3", t: { fa: "بیشتر از ۳۰٪", en: "Over 30%" } }] },
  ],
  admin: [
    { id: "tool", ask: { fa: "حسابداری را با چه ابزاری انجام می‌دهید؟", en: "Which accounting tool do you use?" }, opts: [{ id: "2", t: { fa: "DATEV / Fatture in Cloud", en: "DATEV / Fatture in Cloud" } }, { id: "3", t: { fa: "اکسل", en: "Excel" } }, { id: "1", t: { fa: "حسابدار بیرونی", en: "External accountant" } }] },
    { id: "hours", ask: { fa: "هفته‌ای چند ساعت کار اداری دارید؟", en: "Admin hours per week?" }, opts: [{ id: "1", t: { fa: "کمتر از ۵", en: "Under 5" } }, { id: "2", t: { fa: "۵ تا ۱۵", en: "5–15" } }, { id: "3", t: { fa: "بیشتر از ۱۵", en: "Over 15" } }] },
  ],
};
const goal: Q = {
  id: "goal",
  ask: { fa: "بعد از ۳ ماه، موفقیت برای شما یعنی چه؟", en: "In 3 months, what would success look like?" },
  opts: [{ id: "more", t: { fa: "کار و فروش بیشتر", en: "More jobs & sales" } }, { id: "time", t: { fa: "وقت آزاد بیشتر", en: "More free time" } }, { id: "cost", t: { fa: "هزینه کمتر", en: "Lower costs" } }],
};
const wins: Record<string, { t: T; slug: string; price: string }[]> = {
  quotes: [
    { t: { fa: "ایجنت قیمت‌دهی خودکار", en: "Automatic quote agent" }, slug: "quote-agent", price: "€290–490" },
    { t: { fa: "پیگیری خودکار پیشنهادها", en: "Automatic quote follow-up" }, slug: "followup-agent", price: "€190" },
    { t: { fa: "پاسخ‌گوی ۲۴ ساعته", en: "24/7 answering" }, slug: "phone-agent", price: "€390" },
  ],
  calls: [
    { t: { fa: "پاسخ‌گوی ۲۴ ساعته تلفن و چت", en: "24/7 phone & chat answering" }, slug: "phone-agent", price: "€390" },
    { t: { fa: "ثبت خودکار نوبت در تقویم", en: "Automatic calendar booking" }, slug: "phone-agent", price: "+€0" },
    { t: { fa: "پیگیری خودکار", en: "Automatic follow-up" }, slug: "followup-agent", price: "€190" },
  ],
  admin: [
    { t: { fa: "ورود خودکار فاکتورها", en: "Automatic invoice entry" }, slug: "incentive-docs", price: "€49+" },
    { t: { fa: "پرونده‌ساز مشوق‌ها", en: "Incentive paperwork assistant" }, slug: "incentive-docs", price: "€49/file" },
    { t: { fa: "پیگیری خودکار", en: "Automatic follow-up" }, slug: "followup-agent", price: "€190" },
  ],
};

type Msg = { me: boolean; text: string; card?: React.ReactNode };

export function Checkup({ locale }: { locale: string }) {
  const fa = locale.startsWith("fa");
  const p = (x: T) => (fa ? x.fa : x.en);
  const [log, setLog] = useState<Msg[]>([{ me: false, text: fa ? "سلام! من ایجنت چک‌آپ هستم. نام شرکت یا آدرس وب‌سایتتان را بنویسید تا اطلاعات عمومی را خودم پیدا کنم و فقط چند سؤال لازم بپرسم." : "Hi! I'm the check-up agent. Type your company name or website; I'll look up the public facts myself and only ask what I need." }]);
  const [stage, setStage] = useState<"company" | "confirm" | "q" | "email" | "report">("company");
  const [queue, setQueue] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [company, setCompany] = useState("");
  const say = (m: Msg[]) => setLog((l) => [...l, ...m]);

  const submitCompany = () => {
    if (!input.trim()) return;
    setCompany(input);
    say([
      { me: true, text: input },
      { me: false, text: fa ? "این را از داده‌های عمومی پیدا کردم. درست است؟" : "Here is what I found in public data. Is it right?", card: (
        <div className="card small" style={{ marginTop: 8 }}>
          <div>🏭 <b>{fa ? "صنعت" : "Industry"}:</b> {fa ? "شیشه و پنجره" : "Glass & windows"} <span className="ltr muted">NACE C23.12</span></div>
          <div>📍 <b>{fa ? "کشور" : "Country"}:</b> 🇩🇪 Deutschland · Köln</div>
          <div>👥 <b>{fa ? "اندازه" : "Size"}:</b> ≈ 12</div>
          <div>🧰 <b>{fa ? "ابزارهای روی سایت" : "Tools on website"}:</b> WordPress · {fa ? "فرم تماس" : "contact form"} · Outlook</div>
          <div className="muted" style={{ marginTop: 4 }}>{fa ? "منبع: ثبت شرکت‌ها، وب‌سایت عمومی" : "Source: company register, public website"}</div>
        </div>
      ) },
    ]);
    setInput("");
    setStage("confirm");
  };
  const confirm = () => {
    say([{ me: true, text: fa ? "بله، درست است" : "Yes, correct" }, { me: false, text: p(area.ask) }]);
    setQueue([area]);
    setStage("q");
  };
  const answer = (q: Q, o: Opt) => {
    const next = { ...answers, [q.id]: o.id };
    setAnswers(next);
    let rest = queue.slice(1);
    if (q.id === "area") rest = [...branch[o.id], goal];
    say([{ me: true, text: p(o.t) }]);
    if (rest.length) {
      setQueue(rest);
      say([{ me: false, text: p(rest[0].ask) }]);
    } else {
      setStage("email");
      say([{ me: false, text: fa ? "عالی، کافی است. گزارش را کجا بفرستم؟" : "Great, that's enough. Where should I send the report?" }]);
    }
  };

  if (stage === "report") {
    const a = answers.area ?? "quotes";
    const pain = Object.entries(answers).filter(([k]) => !["area", "goal"].includes(k)).reduce((s, [, v]) => s + Number(v), 0);
    const hours = 12 + pain * 7;
    const score = Math.min(88, 41 + pain * 4);
    return (
      <div className="stack" style={{ gap: 16 }}>
        <span className="badge ok" style={{ justifySelf: "start" }}>✓ {fa ? "گزارش چک‌آپ" : "Check-up report"} · {company}</span>
        <div className="grid g3">
          <div className="card" style={{ display: "grid", justifyItems: "center" }}><div className="ring" style={{ ["--p" as string]: score }}><div>{score}</div></div><div className="muted small">{fa ? "آمادگی AI" : "AI readiness"}</div></div>
          <div className="card stat"><div className="label">{fa ? "صرفه‌جویی تخمینی" : "Estimated savings"}</div><div className="value num">{hours} h</div><div className="delta up">≈ €{(hours * 38).toLocaleString("en-US")} / {fa ? "ماه" : "month"}</div></div>
          <div className="card stat"><div className="label">{fa ? "در برابر هم‌صنف‌ها" : "Vs. peers"}</div><div className="value num">{score > 60 ? "Top 30%" : "Top 60%"}</div><div className="delta muted">{fa ? "۴۸ شیشه‌بری آلمانی" : "48 German glaziers"}</div></div>
        </div>
        <div className="card">
          <h3>{fa ? "۳ برد سریع شما" : "Your 3 quick wins"}</h3>
          <div className="list">
            {wins[a].map((w, i) => (
              <div key={i} className="item"><span className="badge">{i + 1}</span><div className="grow"><b>{p(w.t)}</b><div className="muted small">{fa ? "بازه قیمت" : "Price range"}: {w.price} {fa ? "در ماه" : "/ month"}</div></div><Link className="btn sm" href={`/${locale}/market/${w.slug}`}>{fa ? "جزئیات" : "Details"}</Link></div>
            ))}
          </div>
        </div>
        <div className="row">
          <button className="btn primary lg">{fa ? "رزرو تماس ۲۰ دقیقه‌ای" : "Book a 20-minute call"}</button>
          <Link className="btn lg" href="/portal">{fa ? "ساخت حساب و شروع" : "Create account & start"}</Link>
        </div>
        <p className="muted small">{fa ? "نسخه نمایشی. در نسخه واقعی: گزارش PDF به ایمیل می‌رود، سرنخ با امتیاز در CRM ثبت می‌شود (پرسونای پله ۲) و ایجنت فروش پیگیری را آماده می‌کند." : "Demo. Real version: PDF report by email, lead saved in the CRM with a score (persona tier 2), and the sales agent prepares the follow-up."}</p>
      </div>
    );
  }

  const q = queue[0];
  return (
    <div className="card" style={{ padding: 22 }}>
      <div className="row" style={{ marginBottom: 6 }}><span className="badge ai">✦ AI</span><b>{fa ? "چک‌آپ رایگان AI" : "Free AI check-up"}</b><span className="spacer" /><span className="muted small">{fa ? "۳ دقیقه · ۵ تا ۷ سؤال" : "3 minutes · 5–7 questions"}</span></div>
      <p className="muted small">{fa ? "شما با AI صحبت می‌کنید. پاسخ‌ها فقط برای ساخت گزارش استفاده می‌شوند." : "You are talking to an AI. Answers are used only to build your report."}</p>
      <div className="chat" aria-live="polite" style={{ margin: "12px 0" }}>
        {log.map((m, i) => <div key={i} className={`msg ${m.me ? "me" : "them"} fade-in`}>{m.text}{m.card}</div>)}
      </div>
      {stage === "company" && (
        <form className="row" onSubmit={(e) => { e.preventDefault(); submitCompany(); }}>
          <label className="sr-only" htmlFor="co">{fa ? "نام شرکت یا وب‌سایت" : "Company or website"}</label>
          <input id="co" value={input} onChange={(e) => setInput(e.target.value)} placeholder="glas-becker.de" className="ltr" style={{ flex: 1 }} />
          <button className="btn primary">{fa ? "ارسال" : "Send"}</button>
        </form>
      )}
      {stage === "confirm" && <div className="row"><button className="chip" onClick={confirm}>{fa ? "بله، درست است" : "Yes, correct"}</button><button className="chip" onClick={confirm}>{fa ? "صنعت را اصلاح کن" : "Fix the industry"}</button></div>}
      {stage === "q" && q && <div className="row">{q.opts.map((o) => <button key={o.id + o.t.en} className="chip" onClick={() => answer(q, o)}>{p(o.t)}</button>)}</div>}
      {stage === "email" && (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); setStage("report"); }}>
          <div className="row"><label className="sr-only" htmlFor="em">Email</label><input id="em" type="email" required className="ltr" placeholder="name@company.de" style={{ flex: 1 }} /><button className="btn primary">{fa ? "دیدن گزارش" : "See report"}</button></div>
          <label className="choice"><input type="checkbox" required /><span className="small">{fa ? "موافقم پاسخ‌هایم برای ساخت گزارش و تماس درباره آن پردازش شود (داده در اتحادیه اروپا)." : "I agree my answers are processed to build the report and contact me about it (data in the EU)."}</span></label>
        </form>
      )}
    </div>
  );
}
