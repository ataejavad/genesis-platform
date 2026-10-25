"use client";

import { useState } from "react";
import type { MoneyCopy } from "@/config/money-copy";
import { askSignCode, confirmSign } from "./sign-actions";

type Question = { id: string; text: string };

/**
 * Sign in two steps: a code signs the text; a second code approves the onerous clauses (Italy, art. 1341 c.c.).
 * Partners also answer the three independence questions with the first step.
 */
export function SignFlow({ id, t, email, onerous, signedText, questions = [] }: { id: string; t: MoneyCopy; email: string; onerous: { id: string; title: string }[]; signedText: boolean; questions?: Question[] }) {
  const [step, setStep] = useState<"sign" | "clauses" | "done">(signedText ? "clauses" : "sign");
  const [sent, setSent] = useState(false);
  const [demo, setDemo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});

  if (step === "done") return <div className="callout" role="status">✅ {t.signed.replace("{date}", new Date().toLocaleDateString())}</div>;
  const s = step;
  const answered = s === "clauses" || questions.every((q) => q.id in answers);

  async function ask() {
    setBusy(true);
    setError(null);
    const r = await askSignCode(id, s);
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "failed");
    setSent(true);
    setDemo(r.demoCode ?? null);
  }
  async function confirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "");
    setBusy(true);
    setError(null);
    const r = await confirmSign(id, s, code, s === "sign" && questions.length ? answers : undefined);
    setBusy(false);
    if (!r.ok) return setError(r.error === "wrong" ? t.wrong : (r.error ?? "failed"));
    setSent(false);
    setDemo(null);
    setStep(r.done ? "done" : "clauses");
  }

  return (
    <div className="card stack">
      <h3 style={{ margin: 0 }}>{s === "sign" ? t.step1 : t.step2}</h3>
      {s === "sign" ? <p className="small muted" style={{ margin: 0 }}>{t.step1Help.replace("{email}", email)}</p> : (
        <>
          <p className="small muted" style={{ margin: 0 }}>{t.step2Help}</p>
          <ul className="small" style={{ margin: 0 }}>{onerous.map((c) => <li key={c.id}>✱ {c.title}</li>)}</ul>
        </>
      )}
      {s === "sign" && questions.length > 0 && (
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="small"><b>{t.independence}</b></legend>
          {questions.map((q) => (
            <div key={q.id} className="row small">
              <span className="grow" style={{ flex: 1 }}>{q.text}</span>
              <label className="row" style={{ gap: 4 }}><input type="radio" name={q.id} style={{ width: "auto" }} checked={answers[q.id] === true} onChange={() => setAnswers({ ...answers, [q.id]: true })} /> {t.yes}</label>
              <label className="row" style={{ gap: 4 }}><input type="radio" name={q.id} style={{ width: "auto" }} checked={answers[q.id] === false} onChange={() => setAnswers({ ...answers, [q.id]: false })} /> {t.no}</label>
            </div>
          ))}
        </fieldset>
      )}
      {!sent ? (
        <div><button type="button" className="btn primary" disabled={busy || !answered} onClick={ask}>{busy ? "…" : t.sendCode}</button></div>
      ) : (
        <form onSubmit={confirm} className="row">
          <label className="field" style={{ maxWidth: 200 }}>{t.code}<input name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} required autoComplete="one-time-code" dir="ltr" autoFocus /></label>
          <button className="btn primary" disabled={busy} style={{ alignSelf: "end" }}>{busy ? "…" : s === "sign" ? t.confirm : t.confirm2}</button>
          <button type="button" className="btn" disabled={busy} onClick={ask} style={{ alignSelf: "end" }}>{t.sendCode}</button>
        </form>
      )}
      {demo && <div className="callout small" role="status">{t.demoCode.replace("{code}", demo)}</div>}
      {error && <p role="alert" style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
    </div>
  );
}
