"use client";

import { useEffect, useId, useState } from "react";
import type { SiteCopy } from "@/config/site-copy";

// Consent first (doc 15 §6ه.4): analytics load only after "accept". Choice kept in this browser.
export function CookieBanner({ c }: { c: SiteCopy }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { setOpen(!localStorage.getItem("consent")); } catch { setOpen(true); }
  }, []);
  const choose = (v: string) => { try { localStorage.setItem("consent", v); } catch {} setOpen(false); };
  if (!open) return null;
  return (
    <div className="cookie" role="dialog" aria-label="cookies">
      <p className="small" style={{ marginBottom: 10 }}>🍪 {c.cookie.text}</p>
      <div className="row">
        <button className="btn primary sm" onClick={() => choose("all")}>{c.cookie.accept}</button>
        <button className="btn sm" onClick={() => choose("necessary")}>{c.cookie.reject}</button>
        <button className="btn sm" onClick={() => choose("necessary")}>{c.cookie.settings}</button>
      </div>
    </div>
  );
}

/**
 * Newsletter sign-up (doc 11: the email list is the media's hub). Consent box unticked by default (Italy needs prior
 * consent even for B2B), double opt-in email, honeypot. A `?from=media-…` in the address (links in our LinkedIn posts)
 * is kept as a tag so Cockpit › Media can count what the media brings.
 */
export function Newsletter({ c, hub, locale, industry = "general", country, brand }: { c: SiteCopy; hub?: string; locale: string; industry?: string; country?: string; brand: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [consent, setConsent] = useState(false);
  const [msg, setMsg] = useState("");
  const consentText = c.newsletter.consent.replace("{brand}", brand);
  const inputId = useId();
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!consent) return setMsg(c.newsletter.consentNeeded);
    const form = new FormData(e.currentTarget);
    let from = "";
    try {
      from = new URLSearchParams(window.location.search).get("from") ?? sessionStorage.getItem("from") ?? "";
    } catch {}
    setState("busy");
    const res = await fetch("/api/v1/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        industry,
        country: country ?? locale.slice(3, 5).toUpperCase(),
        locale,
        hook: "newsletter",
        tags: ["newsletter", ...(from ? [`from:${from.slice(0, 34)}`] : [])],
        consent: true,
        consentText,
        website: String(form.get("website") ?? ""),
      }),
    }).catch(() => null);
    setState(res?.ok ? "done" : "error");
    setMsg(res?.ok ? "" : c.newsletter.error);
  }
  return (
    <div className="newsletter" id="newsletter">
      <div style={{ flex: 1, minWidth: 220 }}>
        <b>📬 {c.newsletter.title}{hub ? ` · ${hub}` : ""}</b>
        <div className="muted small">{c.newsletter.sub}</div>
      </div>
      {state === "done" ? (
        <span className="badge ok" role="status">✓ {c.newsletter.ok}</span>
      ) : (
        <form className="stack" style={{ gap: 6 }} onSubmit={submit}>
          <div className="row">
            <label className="sr-only" htmlFor={inputId}>{c.newsletter.placeholder}</label>
            <input id={inputId} name="email" type="email" required placeholder={c.newsletter.placeholder} className="ltr" style={{ width: 230 }} />
            <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1 }} />
            <button className="btn primary" disabled={state === "busy"}>{c.newsletter.cta}</button>
          </div>
          <label className="small check" style={{ maxWidth: 420 }}><input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setMsg(""); }} /> {consentText}</label>
          {msg && <span className="small" role="alert" style={{ color: "var(--danger, #b42318)" }}>{msg}</span>}
        </form>
      )}
    </div>
  );
}

/** Keeps `?from=…` for this visit, so a sign-up on a later page still counts for the post that brought the visitor. */
export function RememberFrom() {
  useEffect(() => {
    try {
      const f = new URLSearchParams(window.location.search).get("from");
      if (f) sessionStorage.setItem("from", f.slice(0, 40));
    } catch {}
  }, []);
  return null;
}

export function ActionButton({ label, done, className = "btn" }: { label: string; done: string; className?: string }) {
  const [ok, setOk] = useState(false);
  return ok ? <span className="badge ok" role="status">✓ {done}</span> : <button className={className} onClick={() => setOk(true)}>{label}</button>;
}

export function RoiCalc({ fa }: { fa: boolean }) {
  const [staff, setStaff] = useState(10);
  const [hours, setHours] = useState(6);
  const [rate, setRate] = useState(38);
  const saved = Math.round(staff * hours * 4.3 * 0.35);
  return (
    <div className="card stack">
      <h3>📈 {fa ? "ماشین‌حساب صرفه‌جویی" : "Savings calculator"}</h3>
      <div className="grid g3">
        <label className="field">{fa ? "تعداد کارکنان" : "Employees"}<input type="number" min={1} value={staff} onChange={(e) => setStaff(+e.target.value)} /></label>
        <label className="field">{fa ? "ساعت کار تکراری هر نفر در هفته" : "Repetitive hours / person / week"}<input type="number" min={0} value={hours} onChange={(e) => setHours(+e.target.value)} /></label>
        <label className="field">{fa ? "هزینه هر ساعت (یورو)" : "Cost per hour (€)"}<input type="number" min={1} value={rate} onChange={(e) => setRate(+e.target.value)} /></label>
      </div>
      <div className="callout ai" role="status">
        ✦ {fa ? `حدود ${saved} ساعت و €${(saved * rate).toLocaleString("en-US")} در ماه قابل صرفه‌جویی است (فرض: ۳۵٪ کارهای تکراری از دوش شما برداشته می‌شود).` : `About ${saved} hours and €${(saved * rate).toLocaleString("en-US")} a month can be saved (assumes 35% of repetitive work taken off your hands).`}
      </div>
    </div>
  );
}
