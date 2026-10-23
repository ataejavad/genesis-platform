"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SiteCopy } from "@/config/site-copy";
import { pick, products, freeTools, liveIndustries } from "@/mock/site";
import { rememberIndustry } from "@/ui/site/Remember";
import { Conversation, type CheckupDefs } from "@/ui/site/Conversation";
import { industryWords } from "@/lib/industry-words";

// Home-page concierge (doc 15 §6ه.1): the agent answers from the approved catalogue and, beside the chat,
// the page shows content matched to the need it detects. Prototype: keyword detection + canned replies.
type Need = "calls" | "quotes" | "paperwork" | "followup";
const detect: [Need, RegExp][] = [
  ["calls", /call|phone|anruf|telefon|chiamat|تماس|تلفن/i],
  ["quotes", /quote|angebot|preventiv|قیمت|پیش‌فاکتور/i],
  ["paperwork", /paper|papier|burocr|ecobonus|invoice|rechnung|fattur|کاغذ|اسناد|مدارک|مشوق|فاکتور/i],
  ["followup", /follow|nachfass|segui|پیگیری|جواب نمی/i],
];
// Candidates per need; the panel keeps only those sold to the visitor's industry (glass quotes ≠ metal quotes).
const productFor: Record<Need, string[]> = {
  calls: ["phone-agent"],
  quotes: ["quote-agent", "drawing-quote", "followup-agent"],
  paperwork: ["incentive-docs", "compliance-pack", "field-reports"],
  followup: ["followup-agent"],
};
type Lang = "fa" | "en" | "de" | "it";
const replies: Record<Lang, Record<Need | "other", string>> = {
  fa: {
    calls: "برای شرکت‌های هم‌اندازه شما، ۹۷٪ تماس‌ها شبانه‌روز جواب داده می‌شود و نوبت و درخواست قیمت را ثبت می‌کند. راه‌اندازی ۳ روز است.",
    quotes: "پیش‌فاکتور شما به جای ۲ روز در حدود ۱۲ دقیقه آماده می‌شود. همراهش پیگیری خودکار هم پیشنهاد می‌کنم.",
    paperwork: "کاغذبازی مشوق‌ها و اسناد را ما انجام می‌دهیم: پرونده در ۱ روز آماده است.",
    followup: "پیگیری خودکار ۳ و ۷ روز بعد پیام می‌فرستد و معمولاً ۲۲٪ پیشنهادهای بی‌جواب را زنده می‌کند.",
    other: "متوجه شدم. برای اینکه دقیق پیشنهاد بدهم، چک‌آپ رایگان ۳ دقیقه‌ای را شروع کنید یا بگویید در چه صنعت و کشوری کار می‌کنید.",
  },
  en: {
    calls: "For companies your size, 97% of calls get answered, day and night, and every booking and quote request is written down for you. Running in 3 days.",
    quotes: "Your quotes go out in about 12 minutes instead of 2 days. I'd pair it with automatic follow-up.",
    paperwork: "We do your incentive and document paperwork: the file is ready in 1 day.",
    followup: "Automatic follow-up nudges after 3 and 7 days and usually revives 22% of silent quotes.",
    other: "Got it. To recommend precisely, start the 3-minute free check-up or tell me your industry and country.",
  },
  de: {
    calls: "97 % Ihrer Anrufe werden rund um die Uhr angenommen, jeder Termin und jede Anfrage wird für Sie notiert. Läuft in 3 Tagen.",
    quotes: "Ihre Angebote sind in etwa 12 Minuten statt 2 Tagen raus.",
    paperwork: "Förder- und Dokumentenarbeit erledigen wir: die Akte ist in 1 Tag fertig.",
    followup: "Automatisches Nachfassen nach 3 und 7 Tagen holt meist 22 % der stillen Angebote zurück.",
    other: "Verstanden. Starten Sie den 3-Minuten-Gratis-Check oder nennen Sie Branche und Land.",
  },
  it: {
    calls: "Il 97% delle vostre chiamate riceve risposta, giorno e notte, e ogni appuntamento o richiesta viene annotato per voi. Attivo in 3 giorni.",
    quotes: "I vostri preventivi partono in circa 12 minuti invece di 2 giorni.",
    paperwork: "Pratiche e incentivi li facciamo noi: il fascicolo è pronto in 1 giorno.",
    followup: "Il follow-up automatico dopo 3 e 7 giorni recupera di solito il 22% dei preventivi senza risposta.",
    other: "Capito. Inizia il check-up gratuito di 3 minuti o dimmi settore e paese.",
  },
};

export function Concierge({ locale, c, brand, checkups, visitorIndustry, llm }: { locale: string; c: SiteCopy; brand: string; checkups: CheckupDefs; visitorIndustry?: string; llm?: boolean }) {
  const lang = (locale.slice(0, 2) as Lang) in replies ? (locale.slice(0, 2) as Lang) : "en";
  const [needs, setNeeds] = useState<Need[]>([]);
  const [industry, setIndustry] = useState<string | null>(null);
  const router = useRouter();
  // The conversation is the check-up's second door: it answers the pain, then measures it for this firm.
  const heard = (text: string) => {
    const found = detect.find(([, re]) => re.test(text))?.[0];
    if (found) setNeeds((n) => (n.includes(found) ? n : [found, ...n]));
    const ind = liveIndustries.find((i) => industryWords[i.slug]?.test(text));
    if (ind) {
      // Detected industry becomes the visitor's industry site-wide (header, home, solutions).
      setIndustry(ind.slug);
      if (rememberIndustry(ind.slug)) router.refresh();
    }
    return found ? replies[lang][found] : null;
  };
  const sector = industry ?? visitorIndustry;
  const matched = [...new Set(needs.flatMap((n) => productFor[n]))]
    .map((s) => products.find((p) => p.slug === s)!)
    .filter((p) => (sector ? p.industries.includes(sector) : p.slug !== "drawing-quote" && p.slug !== "compliance-pack" && p.slug !== "field-reports"));
  return (
    <div className="concierge">
      <div className="chatbox">
        <div className="row" style={{ marginBottom: 8 }}>
          <span className="badge ai">✦ AI</span>
          <b>{c.chat.title}</b>
        </div>
        <p className="muted small">{c.chat.disclosure}</p>
        <Conversation defs={checkups} industry={visitorIndustry} locale={locale} entrance="home" source="home" c={c} brand={brand} llm={llm} onUserText={heard} greeting={c.chat.hello.replace("{brand}", brand)} />
      </div>
      <div className="live">
        <div className="muted small" style={{ fontWeight: 700 }}>✦ {c.chat.live}</div>
        {industry && (() => {
          const i = liveIndustries.find((x) => x.slug === industry)!;
          return <Link href={`/${locale}/hub/${i.slug}`} className="tile fade-in"><div className="row"><span className="ico">{i.icon}</span><b>{pick(i.name, locale)}</b><span className="spacer" />→</div></Link>;
        })()}
        {matched.length === 0 && !industry && <div className="card empty small">{c.chat.liveEmpty}</div>}
        {matched.map((p) => (
          <Link key={p.slug} href={`/${locale}/market/${p.slug}`} className="tile fade-in">
            <div className="row"><span className="ico">{p.icon}</span><div><b>{pick(p.name, locale)}</b><div className="muted small">{pick(p.kind, locale)} · ★ {p.rating}</div></div></div>
            <div className="small">{pick(p.outcome, locale)}</div>
            <div className="small"><b>{c.market.from} €{p.plans[0].price}</b>{c.market.per}</div>
          </Link>
        ))}
        {matched.length > 0 && <div className="tile fade-in small">{freeTools[0].icon} {pick(freeTools[0].name, locale)}</div>}
      </div>
    </div>
  );
}
