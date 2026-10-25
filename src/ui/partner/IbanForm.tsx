"use client";

import { useActionState } from "react";
import type { MoneyCopy } from "@/config/money-copy";
import { savePayoutAccount } from "./actions";

export function IbanForm({ t, iban, name }: { t: MoneyCopy["iban"]; iban: string | null; name: string | null }) {
  const [state, action, pending] = useActionState(savePayoutAccount, null);
  return (
    <form action={action} className="card stack">
      <h3 style={{ margin: 0 }}>{t.title}</h3>
      <p className="small muted" style={{ margin: 0 }}>{t.sub}</p>
      <div className="grid g2">
        <label className="field">{t.iban}<input name="iban" required dir="ltr" defaultValue={iban ?? ""} autoComplete="off" /></label>
        <label className="field">{t.name}<input name="name" required defaultValue={name ?? ""} /></label>
      </div>
      <div className="row"><button className="btn primary" disabled={pending}>{t.save}</button>{state && <span className={`badge ${state === "saved" ? "ok" : "warn"}`} role="status">{state === "saved" ? t.saved : t.bad}</span>}</div>
    </form>
  );
}
