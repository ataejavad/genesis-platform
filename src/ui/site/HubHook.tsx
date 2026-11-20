"use client";

import { useMemo, useState } from "react";
import type { HubDoc } from "@/server/hubs";
import type { SiteCopy } from "@/config/site-copy";

type Props = {
  hook: HubDoc["hook"];
  deadlines: Pick<HubDoc["deadlines"][number], "id" | "tags" | "date" | "title" | "offer">[];
  copy: SiteCopy["hub"]["hook"];
  brand: string;
  locale: string;
  industry: string;
  country: string;
};

const euro = (n: number, lang: string) => new Intl.NumberFormat(lang, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

// Extra deduction across the bands (e.g. 180% up to €2.5m, 100% up to €10m…) times the tax rate.
export function upliftSaving(amount: number, calc: NonNullable<HubDoc["hook"]["calc"]>) {
  let from = 0;
  let extra = 0;
  for (const band of calc.bands) {
    extra += Math.max(0, Math.min(amount, band.upTo) - from) * band.rate;
    from = band.upTo;
  }
  return extra * calc.taxRate;
}

/**
 * The hub's hook (value filter: every hub page must win customers). Gives first: the visitor's own deadline list
 * appears as soon as they answer; the email is only asked for reminders, with explicit consent (Italian law needs it even B2B).
 */
export function HubHook({ hook, deadlines, copy, brand, locale, industry, country }: Props) {
  const lang = locale.slice(0, 2);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [amount, setAmount] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [reminders, setReminders] = useState(true);
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error" | "consent">("idle");
  const consentText = copy.consent.replace("{brand}", brand);

  const tags = useMemo(() => new Set(Object.values(picked).flat().filter(Boolean)), [picked]);
  const answered = hook.questions.every((q) => picked[q.id]?.length);
  const mine = deadlines.filter((d) => d.tags.includes("all") || d.tags.some((t) => tags.has(t)));
  const calc = hook.calc && tags.has(hook.calc.when) ? hook.calc : undefined;
  const saving = calc && Number(amount) > 0 ? upliftSaving(Number(amount), calc) : null;

  const toggle = (q: HubDoc["hook"]["questions"][number], tag: string) =>
    setPicked((p) => {
      const cur = p[q.id] ?? [];
      const next = q.multi ? (cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]) : [tag];
      return { ...p, [q.id]: next };
    });

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!consent) return setState("consent");
    setState("sending");
    const res = await fetch("/api/v1/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        industry,
        country,
        locale,
        hook: hook.id,
        answers: { ...picked, ...(saving !== null ? { investment: Number(amount) } : {}) },
        tags: [...tags],
        consent: true,
        consentText,
        reminders,
        website: (new FormData(e.currentTarget).get("website") as string) || undefined,
      }),
    }).catch(() => null);
    setState(res?.ok ? "sent" : "error");
  }

  return (
    <section id="hook" className="card hook" aria-labelledby="hook-title">
      <h2 id="hook-title" style={{ marginTop: 0 }}>🎯 {hook.title}</h2>
      <p className="muted">{hook.promise}</p>
      {hook.questions.map((q) => (
        <fieldset key={q.id} className="hook-q">
          <legend><b>{q.label}</b></legend>
          <div className="row">
            {q.options.map((o) => {
              const on = picked[q.id]?.includes(o.tag) ?? false;
              return (
                <button key={o.tag || "none"} type="button" className="chip" aria-pressed={on} onClick={() => toggle(q, o.tag)} style={on ? { borderColor: "var(--brand)", background: "var(--brand-soft)" } : undefined}>
                  {on ? "✓ " : ""}{o.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
      {calc && (
        <div className="hook-q">
          <label htmlFor="hook-amount"><b>{calc.label}</b></label>
          <div className="row">
            <input id="hook-amount" inputMode="numeric" className="ltr" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} placeholder="500000" style={{ width: 180 }} />
            {saving !== null && <span className="badge ok" role="status">{calc.result} <b>{euro(saving, lang)}</b></span>}
          </div>
        </div>
      )}
      {answered && (
        <div className="hook-result" role="status">
          <h3>{copy.yours}</h3>
          {mine.length ? (
            <ul>{mine.map((d) => <li key={d.id}><a href={`#d-${d.id}`}><b>{d.date ?? "•"}</b> {d.title}</a></li>)}</ul>
          ) : <p className="muted">{copy.none}</p>}
          {state === "sent" ? (
            <p className="badge ok" role="status">✓ {copy.sent}</p>
          ) : (
            <form onSubmit={send} className="hook-form">
              <div className="row">
                <label className="sr-only" htmlFor="hook-email">{copy.email}</label>
                <input id="hook-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={copy.email} className="ltr" style={{ flex: 1, minWidth: 220 }} />
                <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999 }} />
                <button className="btn primary" disabled={state === "sending"}>{copy.cta}</button>
              </div>
              <label className="small check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> {consentText}</label>
              <label className="small check"><input type="checkbox" checked={reminders} onChange={(e) => setReminders(e.target.checked)} /> {copy.reminders}</label>
              <p className="muted small">🔒 {copy.privacy}</p>
              {state === "consent" && <p className="small" style={{ color: "var(--bad)" }} role="alert">{copy.consentNeeded}</p>}
              {state === "error" && <p className="small" style={{ color: "var(--bad)" }} role="alert">{copy.error}</p>}
            </form>
          )}
        </div>
      )}
    </section>
  );
}
