"use client";

import { useEffect, useRef, useState } from "react";
import type { PartnerCopy } from "@/config/partner-copy";
import { isEmail } from "@/lib/chat-match";

type Msg = { role: "user" | "assistant"; text: string };
type Step = "kind" | "name" | "email" | "country" | "langs" | "skills" | "links" | "pitch" | "consent" | "busy" | "done";

const COUNTRIES = ["IT", "DE", "AT", "CH", "ES", "FR", "PT", "PL", "RO", "GB"];
const LANGS = ["it", "de", "en", "fr", "es", "fa"];

/**
 * "Work with us" as a short conversation (Javad 2026-10-23: no forms). Chips for choices, typed answers for
 * the rest; the finished application goes to /api/v1/partners/apply and is screened at once.
 */
export function Apply({ t, skills, locale, brand }: { t: PartnerCopy["apply"]; skills: { id: string; label: string }[]; locale: string; brand: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", text: t.hello }]);
  const [step, setStep] = useState<Step>("kind");
  const [a, setA] = useState<{ kind?: string; name?: string; email?: string; country?: string; languages: string[]; skills: string[]; links: string[]; pitch?: string }>({ languages: [], skills: [], links: [] });
  const [input, setInput] = useState("");
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" }); }, [msgs]);

  const say = (user: string, bot?: string) => setMsgs((m) => [...m, { role: "user", text: user }, ...(bot ? [{ role: "assistant" as const, text: bot }] : [])]);
  const label = (id: string) => skills.find((s) => s.id === id)?.label ?? id;

  async function submit(final: typeof a) {
    setStep("busy");
    const res = await fetch("/api/v1/partners/apply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...final, locale, consent: true }) }).catch(() => null);
    if (res?.ok) { setMsgs((m) => [...m, { role: "assistant", text: t.sent }]); setStep("done"); }
    else { setMsgs((m) => [...m, { role: "assistant", text: t.error }]); setStep("consent"); }
  }

  function typed(text: string) {
    const v = text.trim();
    if (!v) return;
    setInput("");
    if (step === "name") { setA((x) => ({ ...x, name: v })); say(v, t.askEmail); setStep("email"); }
    else if (step === "email") {
      if (!isEmail(v)) return say(v, t.badEmail);
      setA((x) => ({ ...x, email: v })); say(v, t.askCountry); setStep("country");
    } else if (step === "country") {
      const cc = v.toUpperCase().slice(0, 2);
      if (!/^[A-Z]{2}$/.test(cc)) return say(v, t.askCountry);
      setA((x) => ({ ...x, country: cc })); say(v, t.askLangs); setStep("langs");
    } else if (step === "links") {
      const urls = v.split(/\s+/).filter((u) => /^https?:\/\/\S+\.\S+/.test(u)).slice(0, 5);
      setA((x) => ({ ...x, links: urls })); say(v, t.askPitch); setStep("pitch");
    } else if (step === "pitch") { setA((x) => ({ ...x, pitch: v.slice(0, 3000) })); say(v, t.consent.replace("{brand}", brand)); setStep("consent"); }
  }

  const chip = (key: string, text: string, onClick: () => void, on = false) => (
    <button key={key} type="button" className="chip" aria-pressed={on} onClick={onClick} style={on ? { borderColor: "var(--brand)", background: "var(--brand-soft)" } : undefined}>{on ? "✓ " : ""}{text}</button>
  );
  const toggle = (k: "languages" | "skills", id: string, max: number) => setA((x) => ({ ...x, [k]: x[k].includes(id) ? x[k].filter((y) => y !== id) : x[k].length < max ? [...x[k], id] : x[k] }));
  const typing = ["name", "email", "country", "links", "pitch"].includes(step);

  return (
    <div className="card chatbox conversation" style={{ padding: 22 }}>
      <div className="chatlog" ref={log} aria-live="polite">
        {msgs.map((m, i) => <div key={i} className={`msg ${m.role === "user" ? "me" : "them"} fade-in`}>{m.text}</div>)}
        {step === "busy" && <div className="msg them muted">…</div>}
      </div>
      <div className="row chips" style={{ margin: "10px 0", flexWrap: "wrap", gap: 6 }}>
        {step === "kind" && Object.entries(t.kind).map(([k, v]) => chip(k, v, () => { setA((x) => ({ ...x, kind: k })); say(v, t.askName); setStep("name"); }))}
        {step === "country" && COUNTRIES.map((c) => chip(c, c, () => typed(c)))}
        {step === "langs" && <>{LANGS.map((l) => chip(l, l.toUpperCase(), () => toggle("languages", l, 8), a.languages.includes(l)))}<button type="button" className="btn sm primary" disabled={!a.languages.length} onClick={() => { say(a.languages.map((l) => l.toUpperCase()).join(", "), t.askSkills); setStep("skills"); }}>{t.next}</button></>}
        {step === "skills" && <>{skills.map((s) => chip(s.id, s.label, () => toggle("skills", s.id, 6), a.skills.includes(s.id)))}<button type="button" className="btn sm primary" disabled={!a.skills.length} onClick={() => { say(a.skills.map(label).join(", "), t.askLinks); setStep("links"); }}>{t.next}</button></>}
        {step === "links" && chip("skip", t.skip, () => { say(t.skip, t.askPitch); setStep("pitch"); })}
        {step === "pitch" && chip("skip", t.skip, () => { say(t.skip, t.consent.replace("{brand}", brand)); setStep("consent"); })}
        {step === "consent" && chip("agree", `✓ ${t.agree}`, () => { say(t.agree); void submit(a); })}
      </div>
      {typing && (
        <form className="row" onSubmit={(e) => { e.preventDefault(); typed(input); }}>
          <label className="sr-only" htmlFor="apply-input">{t.placeholder}</label>
          <input id="apply-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t.placeholder} type={step === "email" ? "email" : "text"} autoComplete={step === "email" ? "email" : step === "name" ? "name" : "off"} />
          <button className="btn primary">→</button>
        </form>
      )}
    </div>
  );
}
