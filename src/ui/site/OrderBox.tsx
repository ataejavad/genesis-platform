"use client";

import { useEffect, useRef, useState } from "react";
import { isEmail } from "@/lib/chat-match";

type Pkg = { slug: string; setupEur: number; monthlyEur: number } | null;
type Step = "pick" | "company" | "email" | "vat" | "consent" | "busy" | "done";

const C = {
  en: { plans: "Plans & pricing", setup: "one-off setup", order: "Start", ask: "Ask the chat", noLock: "No long-term contract · cancel monthly", interest: "Tell me when it is available", hello: "Great choice. Three short questions and you are done. Your company name?", email: "Where do we send the confirmation? (email)", badEmail: "That email looks incomplete. Again?", vat: "Your VAT number, for the invoice? (or skip)", skip: "Skip", consent: "Last step: you accept our terms and the data processing agreement (DPA). We invoice the setup when it is live; pay by SEPA transfer.", agree: "I accept", sent: "Ordered. We confirm the start within one working day and you will find it under My services.", error: "Something went wrong. Please try again.", placeholder: "Write here…", notYet: "This one is not orderable online yet: ask the chat and we set it up with you." },
  it: { plans: "Piani e prezzi", setup: "attivazione una tantum", order: "Avvia", ask: "Chiedi in chat", noLock: "Nessun vincolo · disdetta mensile", interest: "Avvisatemi quando è disponibile", hello: "Ottima scelta. Tre domande brevi e avete finito. Nome dell'azienda?", email: "Dove inviamo la conferma? (email)", badEmail: "L'email sembra incompleta. Di nuovo?", vat: "Partita IVA per la fattura? (o salta)", skip: "Salta", consent: "Ultimo passo: accettate le condizioni e l'accordo sul trattamento dei dati (DPA). Fatturiamo l'attivazione quando è operativa; pagamento con bonifico SEPA.", agree: "Accetto", sent: "Ordinato. Confermiamo l'avvio entro un giorno lavorativo e lo trovate in I miei servizi.", error: "Qualcosa è andato storto. Riprovate.", placeholder: "Scrivete qui…", notYet: "Questo non si ordina ancora online: chiedete in chat e lo impostiamo con voi." },
  de: { plans: "Pakete & Preise", setup: "einmalige Einrichtung", order: "Starten", ask: "Im Chat fragen", noLock: "Keine Mindestlaufzeit · monatlich kündbar", interest: "Sagen Sie mir, wenn es verfügbar ist", hello: "Gute Wahl. Drei kurze Fragen, dann sind Sie fertig. Name Ihrer Firma?", email: "Wohin schicken wir die Bestätigung? (E-Mail)", badEmail: "Die E-Mail wirkt unvollständig. Noch einmal?", vat: "Ihre USt-IdNr. für die Rechnung? (oder überspringen)", skip: "Überspringen", consent: "Letzter Schritt: Sie akzeptieren unsere Bedingungen und den Auftragsverarbeitungsvertrag (AVV). Die Einrichtung stellen wir nach dem Start in Rechnung; Zahlung per SEPA-Überweisung.", agree: "Ich stimme zu", sent: "Bestellt. Wir bestätigen den Start innerhalb eines Werktags; Sie finden es unter Meine Leistungen.", error: "Etwas ist schiefgelaufen. Bitte erneut versuchen.", placeholder: "Hier schreiben…", notYet: "Das ist noch nicht online bestellbar: fragen Sie im Chat, wir richten es mit Ihnen ein." },
  fa: { plans: "پلن‌ها و قیمت", setup: "راه‌اندازی یک‌باره", order: "شروع", ask: "از چت بپرسید", noLock: "بدون قرارداد بلندمدت · لغو ماهانه", interest: "وقتی آماده شد خبرم کنید", hello: "انتخاب خوبی است. سه سؤال کوتاه و تمام. نام شرکت؟", email: "تأیید را به کجا بفرستیم؟ (ایمیل)", badEmail: "ایمیل ناقص به نظر می‌رسد. دوباره؟", vat: "شماره مالیاتی برای فاکتور؟ (یا رد شوید)", skip: "رد شو", consent: "قدم آخر: شرایط خدمات و قرارداد حفاظت داده (DPA) را می‌پذیرید. هزینه راه‌اندازی را بعد از راه افتادن فاکتور می‌کنیم؛ پرداخت با انتقال SEPA.", agree: "می‌پذیرم", sent: "سفارش ثبت شد. شروع کار را تا یک روز کاری تأیید می‌کنیم و در «خدمات من» می‌بینید.", error: "مشکلی پیش آمد. دوباره امتحان کنید.", placeholder: "اینجا بنویسید…", notYet: "این هنوز آنلاین سفارش داده نمی‌شود: از چت بپرسید تا با شما راه بیندازیم." },
};

/**
 * Ordering is a short conversation too (no forms, Javad 2026-10-23). Only catalogue packages can be ordered
 * (no protocol, no sale); the order lands in Cockpit › Projects and becomes a project with one click.
 */
export function OrderBox({ locale, plans, pkg, industry, country }: { locale: string; plans: { name: string; price: number; per: string; features: string[] }[]; pkg: Pkg; industry: string; country: string }) {
  const lang = locale.slice(0, 2) as keyof typeof C;
  const t = C[lang] ?? C.en;
  const [step, setStep] = useState<Step>("pick");
  const [msgs, setMsgs] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [a, setA] = useState<{ company?: string; email?: string; vat?: string }>({});
  const [input, setInput] = useState("");
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" }); }, [msgs]);
  const say = (user: string, bot?: string) => setMsgs((m) => [...m, { role: "user", text: user }, ...(bot ? [{ role: "assistant" as const, text: bot }] : [])]);

  async function submit() {
    setStep("busy");
    const res = await fetch("/api/v1/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ packageSlug: pkg!.slug, company: a.company, email: a.email, vat: a.vat, country: country.toUpperCase(), industry, locale: lang }) }).catch(() => null);
    setMsgs((m) => [...m, { role: "assistant", text: res?.ok ? t.sent : t.error }]);
    setStep(res?.ok ? "done" : "consent");
  }

  function typed(text: string) {
    const v = text.trim();
    if (!v) return;
    setInput("");
    if (step === "company") { setA((x) => ({ ...x, company: v })); say(v, t.email); setStep("email"); }
    else if (step === "email") {
      if (!isEmail(v)) return say(v, t.badEmail);
      setA((x) => ({ ...x, email: v })); say(v, t.vat); setStep("vat");
    } else if (step === "vat") { setA((x) => ({ ...x, vat: v.slice(0, 40) })); say(v, t.consent); setStep("consent"); }
  }

  if (step === "pick")
    return (
      <aside className="card stack" style={{ position: "sticky", top: 90 }}>
        <h3>{t.plans}</h3>
        {plans.map((p) => (
          <div key={p.name} className="choice" style={{ alignItems: "flex-start" }}>
            <div><b>{p.name} · €{p.price}</b> <span className="muted small">{p.per}</span>{pkg && <div className="muted small">+ €{pkg.setupEur} {t.setup}</div>}<ul className="small" style={{ margin: "4px 0 0", paddingInlineStart: 18 }}>{p.features.map((f) => <li key={f}>{f}</li>)}</ul></div>
          </div>
        ))}
        {pkg ? <button className="btn primary lg" onClick={() => { setMsgs([{ role: "assistant", text: t.hello }]); setStep("company"); }}>{t.order}</button> : <p className="muted small" style={{ margin: 0 }}>{t.notYet}</p>}
        <a className="btn" href={`/${locale}#chat`}>{t.ask}</a>
        <p className="muted small" style={{ margin: 0 }}>{t.noLock}</p>
      </aside>
    );

  const typing = ["company", "email", "vat"].includes(step);
  return (
    <aside className="card chatbox conversation stack" style={{ position: "sticky", top: 90 }}>
      <div className="chatlog" ref={log} aria-live="polite">
        {msgs.map((m, i) => <div key={i} className={`msg ${m.role === "user" ? "me" : "them"} fade-in`}>{m.text}</div>)}
        {step === "busy" && <div className="msg them muted">…</div>}
      </div>
      <div className="row chips" style={{ flexWrap: "wrap", gap: 6 }}>
        {step === "vat" && <button type="button" className="chip" onClick={() => { say(t.skip, t.consent); setStep("consent"); }}>{t.skip}</button>}
        {step === "consent" && <button type="button" className="chip" onClick={() => { say(t.agree); void submit(); }}>✓ {t.agree}</button>}
      </div>
      {typing && (
        <form className="row" onSubmit={(e) => { e.preventDefault(); typed(input); }}>
          <label className="sr-only" htmlFor="order-input">{t.placeholder}</label>
          <input id="order-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t.placeholder} type={step === "email" ? "email" : "text"} autoComplete={step === "email" ? "email" : step === "company" ? "organization" : "off"} />
          <button className="btn primary">→</button>
        </form>
      )}
      {step === "done" && <a className="btn primary" href="/portal/services">→ /portal</a>}
    </aside>
  );
}
