"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    setBusy(false);
    if (error) setError("ایمیل یا رمز اشتباه است");
    else window.location.href = "/cockpit";
  }

  return (
    <main style={{ maxWidth: 400, margin: "12vh auto", padding: 16 }}>
      <div className="row" style={{ marginBottom: 18 }}>
        <span className="logo">L</span>
        <h1 style={{ margin: 0 }}>ورود به کابین</h1>
      </div>
      <form onSubmit={onSubmit} className="card stack">
        <label className="field">ایمیل<input name="email" type="email" required autoComplete="email" dir="ltr" /></label>
        <label className="field">رمز<input name="password" type="password" required autoComplete="current-password" dir="ltr" /></label>
        <button className="btn primary" disabled={busy}>{busy ? "…" : "ورود"}</button>
        {error && <p style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
        <p className="muted small" style={{ margin: 0 }}>نسخه محلی: admin@local.test / local-demo-password</p>
      </form>
    </main>
  );
}
