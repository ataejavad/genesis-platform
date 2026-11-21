"use client";

import { useActionState } from "react";
import { type Result, sendAsksNow, testAdminChat, testCompanySearch, testEmail, testPeopleSearch } from "./actions";

function TestButton({ label, run, input }: { label: string; run: (prev: Result, form: FormData) => Promise<Result>; input?: { name: string; placeholder: string } }) {
  const [state, action, pending] = useActionState<Result, FormData>(run, null);
  return (
    <form action={action} className="row" style={{ gap: 6 }}>
      {input && <input name={input.name} placeholder={input.placeholder} className="ltr" style={{ maxWidth: 240 }} />}
      <button className="btn sm" disabled={pending}>{pending ? "Working…" : label}</button>
      {state && <span className={`badge ${state.ok ? "ok" : "warn"}`} role="status" style={{ whiteSpace: "normal" }}>{state.message}</span>}
    </form>
  );
}

export function TestConnections() {
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <h3>Test a connection</h3>
      <p className="muted small">After adding keys and redeploying: one real message or search each (searches save nothing). The phone test also connects the approve/reject buttons; with only the bot token set, it shows your chat id after you write to the bot.</p>
      <div className="stack" style={{ gap: 8 }}>
        <TestButton label="Send test email to me" run={testEmail} />
        <TestButton label="Send test phone message (Telegram)" run={testAdminChat} />
        <TestButton label="Find 5 companies (lead search, ~€0.02)" run={testCompanySearch} />
        <TestButton label="Find decision makers at a website" run={testPeopleSearch} input={{ name: "domain", placeholder: "company website, e.g. brembo.com" }} />
      </div>
    </div>
  );
}

export function SendAsksNow() {
  return <TestButton label="Send waiting approvals to my phone now" run={sendAsksNow} />;
}
