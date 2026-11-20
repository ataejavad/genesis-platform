"use client";

import { useActionState } from "react";
import { type Result, testAdminChat, testEmail } from "./actions";

function TestButton({ label, run }: { label: string; run: () => Promise<Result> }) {
  const [state, action, pending] = useActionState<Result, FormData>(run, null);
  return (
    <form action={action} className="row" style={{ gap: 6 }}>
      <button className="btn sm" disabled={pending}>{pending ? "Sending…" : label}</button>
      {state && <span className={`badge ${state.ok ? "ok" : "warn"}`} role="status" style={{ whiteSpace: "normal" }}>{state.message}</span>}
    </form>
  );
}

export function TestConnections() {
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <h3>Test a connection</h3>
      <p className="muted small">After adding keys and redeploying: one real message each. The phone test also connects the approve/reject buttons.</p>
      <div className="stack" style={{ gap: 8 }}>
        <TestButton label="Send test email to me" run={testEmail} />
        <TestButton label="Send test phone message (Telegram)" run={testAdminChat} />
      </div>
    </div>
  );
}
