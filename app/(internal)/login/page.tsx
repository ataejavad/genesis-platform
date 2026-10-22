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
    <main style={{ maxWidth: 380, margin: "10vh auto" }}>
      <h1>ورود به کابین</h1>
      <form onSubmit={onSubmit} className="card" style={{ display: "grid", gap: 12 }}>
        <input name="email" type="email" placeholder="ایمیل" required autoComplete="email" dir="ltr" />
        <input name="password" type="password" placeholder="رمز" required autoComplete="current-password" dir="ltr" />
        <button className="ok" disabled={busy}>{busy ? "…" : "ورود"}</button>
        {error && <p style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
      </form>
    </main>
  );
}
