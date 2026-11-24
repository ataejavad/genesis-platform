"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

// "Forgot password?" for the team login. The link goes by email and, for the founder, also to the phone (Telegram).
export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const email = String(new FormData(e.currentTarget).get("email")).trim();
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/login/reset" });
    setBusy(false);
    if (error) setError("Could not send the link. Try again in a minute.");
    else setSent(true);
  }

  return (
    <main dir="ltr" style={{ maxWidth: 400, margin: "12vh auto", padding: 16 }}>
      <h1>Forgot password</h1>
      {sent ? (
        <div className="card stack">
          <p style={{ margin: 0 }}>If this email has a login, a link to choose a new password is on its way: by email and, for the founder account, also in Telegram.</p>
          <p className="muted small" style={{ margin: 0 }}>The link works for 1 hour, once.</p>
          <Link href="/login">Back to login</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="card stack">
          <label className="field">Email<input name="email" type="email" required autoComplete="email" dir="ltr" /></label>
          <button className="btn primary" disabled={busy}>{busy ? "…" : "Send me a reset link"}</button>
          {error && <p style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
          <Link href="/login" className="small">Back to login</Link>
        </form>
      )}
    </main>
  );
}
