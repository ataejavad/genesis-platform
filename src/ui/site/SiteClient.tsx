"use client";

import { useEffect, useState } from "react";
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

export function Newsletter({ c, hub }: { c: SiteCopy; hub?: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="newsletter">
      <div style={{ flex: 1, minWidth: 220 }}>
        <b>📬 {c.newsletter.title}{hub ? ` · ${hub}` : ""}</b>
        <div className="muted small">{c.newsletter.sub}</div>
      </div>
      {done ? (
        <span className="badge ok" role="status">✓ {c.newsletter.ok}</span>
      ) : (
        <form className="row" onSubmit={(e) => { e.preventDefault(); setDone(true); }}>
          <label className="sr-only" htmlFor="nl-email">{c.newsletter.placeholder}</label>
          <input id="nl-email" type="email" required placeholder={c.newsletter.placeholder} className="ltr" style={{ width: 230 }} />
          <button className="btn primary">{c.newsletter.cta}</button>
        </form>
      )}
    </div>
  );
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
        ✦ {fa ? `حدود ${saved} ساعت و €${(saved * rate).toLocaleString("en-US")} در ماه قابل صرفه‌جویی است (فرض: ۳۵٪ کارهای تکراری با AI).` : `About ${saved} hours and €${(saved * rate).toLocaleString("en-US")} a month can be saved (assumes 35% of repetitive work automated).`}
      </div>
    </div>
  );
}
