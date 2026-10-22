"use client";

import Link from "next/link";
import { useState } from "react";
import type { SiteCopy } from "@/config/site-copy";
import { pick, products, freeTools } from "@/mock/site";

// Home-page concierge (doc 15 §6ه.1): the agent answers from the approved catalogue and, beside the chat,
// the page shows content matched to the need it detects. Prototype: keyword detection + canned replies.
type Need = "calls" | "quotes" | "paperwork" | "followup";
const detect: [Need, RegExp][] = [
  ["calls", /call|phone|anruf|telefon|chiamat|تماس|تلفن/i],
  ["quotes", /quote|angebot|preventiv|قیمت|پیش‌فاکتور/i],
  ["paperwork", /paper|papier|burocr|ecobonus|invoice|rechnung|fattur|کاغذ|اسناد|مدارک|مشوق|فاکتور/i],
  ["followup", /follow|nachfass|segui|پیگیری|جواب نمی/i],
];
const productFor: Record<Need, string[]> = { calls: ["phone-agent"], quotes: ["quote-agent", "followup-agent"], paperwork: ["incentive-docs"], followup: ["followup-agent"] };
type Lang = "fa" | "en" | "de" | "it";
const replies: Record<Lang, Record<Need | "other", string>> = {
  fa: {
    calls: "برای شرکت‌های هم‌اندازه شما، ایجنت پاسخ‌گوی ۲۴ ساعته ۹۷٪ تماس‌ها را جواب می‌دهد و نوبت و درخواست قیمت را ثبت می‌کند. راه‌اندازی ۳ روز است. چند تماس در روز دارید؟",
    quotes: "ایجنت قیمت‌دهی ما زمان قیمت را از ۲ روز به حدود ۱۲ دقیقه می‌رساند؛ یک شیشه‌بری ۱۲ نفره در کلن با آن ۹ کار بیشتر در ماه گرفت. همراهش پیگیری خودکار هم پیشنهاد می‌کنم.",
    paperwork: "برای کاغذبازی مشوق‌ها و اسناد، دستیار پرونده‌ساز داریم که پرونده را در ۱ روز آماده می‌کند. می‌خواهید با چک‌آپ رایگان دقیق‌تر بسنجیم؟",
    followup: "پیگیری خودکار ۳ و ۷ روز بعد پیام می‌فرستد و معمولاً ۲۲٪ پیشنهادهای بی‌جواب را زنده می‌کند.",
    other: "متوجه شدم. برای اینکه دقیق پیشنهاد بدهم، چک‌آپ رایگان ۳ دقیقه‌ای را شروع کنید یا بگویید در چه صنعت و کشوری کار می‌کنید.",
  },
  en: {
    calls: "For companies your size, our 24/7 answering agent picks up 97% of calls and captures bookings and quote requests. Setup takes 3 days. How many calls do you get a day?",
    quotes: "Our quote agent cuts quoting from 2 days to about 12 minutes; a 12-person glazier in Cologne won 9 more jobs a month. I'd pair it with automatic follow-up.",
    paperwork: "For incentive and document paperwork we have a file assistant that prepares a file in 1 day. Shall we size it precisely with the free check-up?",
    followup: "Automatic follow-up nudges after 3 and 7 days and usually revives 22% of silent quotes.",
    other: "Got it. To recommend precisely, start the 3-minute free check-up or tell me your industry and country.",
  },
  de: {
    calls: "Unser 24/7-Telefonagent nimmt 97 % der Anrufe an und erfasst Termine und Anfragen. Einrichtung in 3 Tagen. Wie viele Anrufe haben Sie pro Tag?",
    quotes: "Unser Angebotsagent verkürzt Angebote von 2 Tagen auf etwa 12 Minuten; ein Glaser in Köln gewann 9 Aufträge mehr pro Monat.",
    paperwork: "Für Förder- und Dokumentenarbeit haben wir einen Akten-Assistenten: fertig in 1 Tag.",
    followup: "Automatisches Nachfassen nach 3 und 7 Tagen holt meist 22 % der stillen Angebote zurück.",
    other: "Verstanden. Starten Sie den 3-Minuten-Gratis-Check oder nennen Sie Branche und Land.",
  },
  it: {
    calls: "Il nostro agente telefonico 24/7 risponde al 97% delle chiamate e registra appuntamenti e richieste. Attivo in 3 giorni. Quante chiamate ricevete al giorno?",
    quotes: "Il nostro agente preventivi riduce i tempi da 2 giorni a circa 12 minuti; una vetreria di Colonia ha ottenuto 9 lavori in più al mese.",
    paperwork: "Per pratiche e incentivi (Ecobonus) abbiamo un assistente che prepara il fascicolo in 1 giorno.",
    followup: "Il follow-up automatico dopo 3 e 7 giorni recupera di solito il 22% dei preventivi senza risposta.",
    other: "Capito. Inizia il check-up gratuito di 3 minuti o dimmi settore e paese.",
  },
};

export function Concierge({ locale, c, brand }: { locale: string; c: SiteCopy; brand: string }) {
  const lang = (locale.slice(0, 2) as Lang) in replies ? (locale.slice(0, 2) as Lang) : "en";
  const [log, setLog] = useState([{ me: false, t: c.chat.hello.replace("{brand}", brand) }]);
  const [q, setQ] = useState("");
  const [needs, setNeeds] = useState<Need[]>([]);
  const send = (text: string) => {
    if (!text.trim()) return;
    const found = detect.find(([, re]) => re.test(text))?.[0];
    setLog((l) => [...l, { me: true, t: text }, { me: false, t: replies[lang][found ?? "other"] }]);
    if (found) setNeeds((n) => (n.includes(found) ? n : [found, ...n]));
    setQ("");
  };
  const matched = [...new Set(needs.flatMap((n) => productFor[n]))].map((s) => products.find((p) => p.slug === s)!);
  return (
    <div className="concierge">
      <div className="chatbox">
        <div className="row" style={{ marginBottom: 8 }}>
          <span className="badge ai">✦ AI</span>
          <b>{c.chat.title}</b>
        </div>
        <p className="muted small">{c.chat.disclosure}</p>
        <div className="chatlog" aria-live="polite">
          {log.map((m, i) => (
            <div key={i} className={`msg ${m.me ? "me" : "them"} fade-in`}>{m.t}</div>
          ))}
        </div>
        <div className="row" style={{ marginBottom: 10 }}>
          {c.chat.examples.map((e) => <button key={e} className="chip" onClick={() => send(e)}>{e}</button>)}
        </div>
        <form className="row" onSubmit={(e) => { e.preventDefault(); send(q); }}>
          <label className="sr-only" htmlFor="concierge-q">{c.chat.title}</label>
          <input id="concierge-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder={c.chat.placeholder} style={{ flex: 1 }} />
          <button className="btn primary">{c.chat.send}</button>
        </form>
      </div>
      <div className="live">
        <div className="muted small" style={{ fontWeight: 700 }}>✦ {c.chat.live}</div>
        {matched.length === 0 && <div className="card empty small">{c.chat.liveEmpty}</div>}
        {matched.map((p) => (
          <Link key={p.slug} href={`/${locale}/market/${p.slug}`} className="tile fade-in">
            <div className="row"><span className="ico">{p.icon}</span><div><b>{pick(p.name, locale)}</b><div className="muted small">{pick(p.kind, locale)} · ★ {p.rating}</div></div></div>
            <div className="small">{pick(p.outcome, locale)}</div>
            <div className="small"><b>{c.market.from} €{p.plans[0].price}</b>{c.market.per}</div>
          </Link>
        ))}
        {matched.length > 0 && (
          <>
            <div className="tile fade-in small">📰 Case: Glas Becker GmbH · −95% quoting time · +9 jobs/month</div>
            <div className="tile fade-in small">{freeTools[0].icon} {pick(freeTools[0].name, locale)}</div>
            <div className="row fade-in">
              <Link className="btn primary" href={`/${locale}/checkup`}>{c.chat.start}</Link>
              <button className="btn">{c.chat.book}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
