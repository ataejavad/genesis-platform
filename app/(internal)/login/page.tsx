"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { OtherLogins } from "@/ui/shared/OtherLogins";
import { PasswordInput } from "@/ui/shared/PasswordInput";

// Team (cockpit) login. The cockpit is English (Javad's choice). The demo password hint shows only on a laptop.
export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState(false);

  useEffect(() => {
    setLocal(["localhost", "127.0.0.1"].includes(window.location.hostname));
    // signed in with a customer or partner account and sent here from /cockpit
    if (new URLSearchParams(window.location.search).get("error") === "forbidden") setError("This account has no team access. Sign in with the founder account.");
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")).trim().toLowerCase(),
      password: String(form.get("password")),
    });
    setBusy(false);
    if (error) setError("Wrong email or password");
    else window.location.href = "/cockpit";
  }

  return (
    <main style={{ maxWidth: 400, margin: "12vh auto", padding: 16 }}>
      <div className="row" style={{ marginBottom: 18 }}>
        <span className="logo">L</span>
        <h1 style={{ margin: 0 }}>Cockpit login</h1>
      </div>
      <form onSubmit={onSubmit} className="card stack">
        <label className="field">Email<input name="email" type="email" required autoComplete="email" dir="ltr" /></label>
        <label className="field">Password<PasswordInput name="password" required autoComplete="current-password" showLabel="Show password" hideLabel="Hide password" /></label>
        <button className="btn primary" disabled={busy}>{busy ? "…" : "Sign in"}</button>
        {error && <p style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
        <Link href="/login/forgot" className="small">Forgot password?</Link>
        {local && <p className="muted small" style={{ margin: 0 }}>Local copy: admin@local.test / local-demo-password</p>}
      </form>
      <OtherLogins lang="en" here="team" />
    </main>
  );
}
