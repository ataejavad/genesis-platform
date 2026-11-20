"use client";

import { useEffect, useState } from "react";
import type { PortalCopy } from "@/config/portal-copy";
import { authClient } from "@/lib/auth-client";

export function LoginForm({ t, next }: { t: PortalCopy["login"]; next: string }) {
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  // sent here because the signed-in account belongs to another door (e.g. a customer opening /partner)
  const [wrongDoor, setWrongDoor] = useState(false);
  useEffect(() => setWrongDoor(new URLSearchParams(window.location.search).has("error")), []);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const { error } = await authClient.signIn.email({ email: String(form.get("email")), password: String(form.get("password")) });
    setBusy(false);
    setError(Boolean(error));
    if (!error) window.location.href = next;
  }
  return (
    <form onSubmit={onSubmit} className="card stack">
      <label className="field">{t.email}<input name="email" type="email" required autoComplete="email" dir="ltr" /></label>
      <label className="field">{t.password}<input name="password" type="password" required autoComplete="current-password" dir="ltr" /></label>
      <button className="btn primary" disabled={busy}>{busy ? "…" : t.go}</button>
      {error && <p role="alert" style={{ color: "var(--bad)", margin: 0 }}>{t.bad}</p>}
      {!error && wrongDoor && <p role="alert" style={{ color: "var(--warn, var(--bad))", margin: 0 }}>{t.wrongDoor}</p>}
    </form>
  );
}
