"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { PasswordInput } from "@/ui/shared/PasswordInput";

// Where the reset link lands (?token=…). Sets the new password; every device is signed out.
export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [bad, setBad] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setToken(q.get("token"));
    setBad(q.get("error") === "INVALID_TOKEN" || !q.get("token"));
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const newPassword = String(form.get("password"));
    if (newPassword.length < 12) return setError("At least 12 characters, please.");
    if (newPassword !== String(form.get("again"))) return setError("The two passwords are not the same.");
    setBusy(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword, token: token ?? "" });
    setBusy(false);
    if (error) setBad(true);
    else setDone(true);
  }

  return (
    <main dir="ltr" style={{ maxWidth: 400, margin: "12vh auto", padding: 16 }}>
      <h1>New password</h1>
      <div className="card stack">
        {done ? (
          <>
            <p style={{ margin: 0 }}>Done. Sign in with your new password.</p>
            <Link href="/login" className="btn primary">Go to login</Link>
          </>
        ) : bad ? (
          <>
            <p style={{ margin: 0 }}>This link has expired or was already used.</p>
            <Link href="/login/forgot">Send a new link</Link>
          </>
        ) : (
          <form onSubmit={onSubmit} className="stack">
            <label className="field">New password (at least 12 characters)<PasswordInput name="password" required autoComplete="new-password" showLabel="Show password" hideLabel="Hide password" /></label>
            <label className="field">Same password again<PasswordInput name="again" required autoComplete="new-password" showLabel="Show password" hideLabel="Hide password" /></label>
            <button className="btn primary" disabled={busy || !token}>{busy ? "…" : "Save new password"}</button>
            {error && <p style={{ color: "var(--bad)", margin: 0 }}>{error}</p>}
          </form>
        )}
      </div>
    </main>
  );
}
