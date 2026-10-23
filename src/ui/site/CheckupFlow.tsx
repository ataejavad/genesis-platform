"use client";

import Link from "next/link";
import { useState } from "react";
import type { SiteCopy } from "@/config/site-copy";
import type { Answers, LocalizedCheckup, LockedReport, Report } from "@/server/checkup";
import { CheckupReport } from "./CheckupReport";

type Props = {
  defs: Record<string, LocalizedCheckup & { name: string; icon: string; country: string }>;
  industry?: string;
  locale: string;
  entrance: "form" | "chat";
  source?: string;
  c: SiteCopy["checkup"];
  brand: string;
  compact?: boolean;
};

/**
 * The one check-up engine behind both entrances. One question at a time, the report as soon as the last answer
 * is in (give first), the plan after email + explicit consent, then "book a call".
 */
export function CheckupFlow({ defs, industry: initial, locale, entrance, source, c, brand, compact }: Props) {
  const [industry, setIndustry] = useState<string | null | "other">(initial && defs[initial] ? initial : null);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [result, setResult] = useState<{ id: string; report: LockedReport | Report; unlocked: boolean } | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "error" | "consent">("idle");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [reminders, setReminders] = useState(true);
  const [called, setCalled] = useState(false);
  const consentText = c.consent.replace("{brand}", brand);

  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    return res?.ok ? res.json() : null;
  };

  if (industry === null) {
    return (
      <div className="stack" style={{ gap: 10 }}>
        <b>{c.industry}</b>
        <div className="row">
          {Object.entries(defs).map(([slug, d]) => <button key={slug} className="chip" onClick={() => setIndustry(slug)}>{d.icon} {d.name}</button>)}
          <button className="chip" onClick={() => setIndustry("other")}>{c.other}</button>
        </div>
      </div>
    );
  }
  if (industry === "other") {
    return (
      <div className="stack" style={{ gap: 10 }}>
        <p>{c.otherText}</p>
        <div className="row"><Link className="btn primary" href={`/${locale}/explore`}>{c.explore}</Link><button className="btn" onClick={() => setIndustry(null)}>{c.back}</button></div>
      </div>
    );
  }

  const def = defs[industry];
  if (!result) {
    const q = def.questions[step];
    const picked = answers[q.id];
    const go = async (next: Answers) => {
      if (step + 1 < def.questions.length) return setStep(step + 1);
      setState("busy");
      const data = await post("/api/v1/checkups", { industry, country: def.country, locale, entrance, source, answers: next });
      if (!data) return setState("error");
      setResult({ ...data, unlocked: false });
      setState("idle");
    };
    const choose = (id: string) => {
      if (q.multi) {
        const cur = Array.isArray(picked) ? picked : [];
        return setAnswers({ ...answers, [q.id]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] });
      }
      const next = { ...answers, [q.id]: id };
      setAnswers(next);
      void go(next);
    };
    return (
      <div className="stack" style={{ gap: 10 }} aria-live="polite">
        <div className="muted small">{c.step.replace("{i}", String(step + 1)).replace("{n}", String(def.questions.length))}</div>
        <progress max={def.questions.length} value={step} style={{ width: "100%" }} />
        <b>{q.label}</b>
        <div className="row">
          {q.options.map((o) => {
            const on = Array.isArray(picked) ? picked.includes(o.id) : picked === o.id;
            return (
              <button key={o.id} className="chip" aria-pressed={on} disabled={state === "busy"} onClick={() => choose(o.id)} style={on ? { borderColor: "var(--brand)", background: "var(--brand-soft)" } : undefined}>
                {on ? "✓ " : ""}{o.label}
              </button>
            );
          })}
        </div>
        <div className="row">
          {step > 0 && <button className="btn sm" onClick={() => setStep(step - 1)}>{c.back}</button>}
          {q.multi && <button className="btn sm primary" disabled={state === "busy"} onClick={() => go(answers)}>{c.next}</button>}
          {state === "busy" && <span className="muted small">{c.computing}</span>}
          {state === "error" && <span className="small" style={{ color: "var(--bad)" }} role="alert">{c.error}</span>}
        </div>
      </div>
    );
  }

  async function unlock(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!consent) return setState("consent");
    setState("busy");
    const website = (new FormData(e.currentTarget).get("website") as string) || undefined;
    const data = await post(`/api/v1/checkups/${result!.id}/unlock`, { email, consent: true, consentText, reminders, website });
    if (!data) return setState("error");
    setResult({ ...result!, report: data.report, unlocked: true });
    setState("idle");
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <CheckupReport report={result.report} c={c} locale={locale} compact={compact} />
      {!result.unlocked ? (
        <form onSubmit={unlock} className="card hook-form" style={{ maxWidth: "none" }}>
          <b>{c.unlockTitle}</b>
          <span className="muted small">{c.unlockSub}</span>
          <div className="row">
            <label className="sr-only" htmlFor={`ck-email-${entrance}`}>{c.email}</label>
            <input id={`ck-email-${entrance}`} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={c.email} className="ltr" style={{ flex: 1, minWidth: 200 }} />
            <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999 }} />
            <button className="btn primary" disabled={state === "busy"}>{c.unlock}</button>
          </div>
          <label className="small check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> {consentText}</label>
          <label className="small check"><input type="checkbox" checked={reminders} onChange={(e) => setReminders(e.target.checked)} /> {c.reminders}</label>
          {state === "consent" && <p className="small" style={{ color: "var(--bad)" }} role="alert">{c.consentNeeded}</p>}
          {state === "error" && <p className="small" style={{ color: "var(--bad)" }} role="alert">{c.error}</p>}
        </form>
      ) : (
        <div className="row">
          {called ? (
            <span className="badge ok" role="status">✓ {c.called}</span>
          ) : (
            <button className="btn primary" onClick={async () => setCalled(Boolean(await post(`/api/v1/checkups/${result.id}/call`, {})))}>{c.call}</button>
          )}
          <Link className="btn" href={`/${locale}/checkup/r/${result.id}`}>{c.link}</Link>
        </div>
      )}
    </div>
  );
}
