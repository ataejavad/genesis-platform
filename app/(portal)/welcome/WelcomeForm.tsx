"use client";

import { useActionState } from "react";
import type { MoneyCopy } from "@/config/money-copy";
import { setPassword } from "./actions";

export function WelcomeForm({ t, token }: { t: MoneyCopy["welcome"]; token: string }) {
  const [state, action, pending] = useActionState(setPassword, null);
  return (
    <form action={action} className="card stack">
      <input type="hidden" name="token" value={token} />
      <label className="field">{t.password}<input name="password" type="password" minLength={12} required autoComplete="new-password" dir="ltr" /></label>
      <button className="btn primary" disabled={pending}>{pending ? "…" : t.go}</button>
      {state && <p role="alert" style={{ color: "var(--bad)", margin: 0 }}>{state === "short" ? t.short : t.bad}</p>}
    </form>
  );
}
