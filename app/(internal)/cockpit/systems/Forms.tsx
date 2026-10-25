"use client";

import { useActionState } from "react";
import { SCOPE_LIST } from "./scopes";
import { emergency, filter, jobSwitch, newKey, type Result, revokeKey, seen } from "./actions";

function Status({ state }: { state: Result }) {
  return state ? <span className={`badge ${state.ok ? "ok" : "warn"}`} role="status" style={{ whiteSpace: "normal" }}>{state.message}</span> : null;
}

export function EmergencyStop({ stopped }: { stopped: boolean }) {
  const [state, action, pending] = useActionState<Result, FormData>(emergency, null);
  return (
    <form action={action} className="row" style={{ gap: 6 }}>
      <input type="hidden" name="op" value={stopped ? "resume" : "stop"} />
      <button className={`btn ${stopped ? "ok" : "danger"}`} disabled={pending}>{stopped ? "▶ Lift the emergency stop" : "⏹ Emergency stop (all agents + outbound)"}</button>
      <Status state={state} />
    </form>
  );
}

export function JobSwitch({ id, enabled }: { id: string; enabled: boolean }) {
  const [state, action, pending] = useActionState<Result, FormData>(jobSwitch, null);
  return <form action={action} className="row" style={{ gap: 6 }}><input type="hidden" name="job" value={id} /><input type="hidden" name="op" value={enabled ? "off" : "on"} /><button className={`btn sm ${enabled ? "" : "ok"}`} disabled={pending}>{enabled ? "Switch off" : "Switch on"}</button><Status state={state} /></form>;
}

export function FilterDecision({ country, nace, decision }: { country: string; nace: string; decision: string }) {
  const [state, action, pending] = useActionState<Result, FormData>(filter, null);
  return (
    <form action={action} className="row" style={{ gap: 6 }}>
      <input type="hidden" name="country" value={country} /><input type="hidden" name="nace" value={nace} />
      {decision !== "approved" && <button className="btn sm ok" name="op" value="approve" disabled={pending}>Approve</button>}
      {decision !== "paused" && <button className="btn sm" name="op" value="pause" disabled={pending}>Pause</button>}
      <Status state={state} />
    </form>
  );
}

export function NewKey() {
  const [state, action, pending] = useActionState<Result, FormData>(newKey, null);
  return (
    <form action={action} className="card stack">
      <h3>New API key</h3>
      <label className="field">Name (who uses it)<input name="name" required minLength={3} placeholder="e.g. n8n invoices" /></label>
      <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>{SCOPE_LIST.map((s) => <label key={s} className="row small" style={{ gap: 4 }}><input type="checkbox" name="scopes" value={s} style={{ width: "auto" }} />{s}</label>)}</div>
      <div className="row"><button className="btn primary" disabled={pending}>Create</button><Status state={state} /></div>
      {state?.secret && <code className="ltr" style={{ wordBreak: "break-all" }}>{state.secret}</code>}
    </form>
  );
}

export function RevokeKey({ id }: { id: string }) {
  const [state, action, pending] = useActionState<Result, FormData>(revokeKey, null);
  if (state?.ok) return <Status state={state} />;
  return <form action={action}><input type="hidden" name="id" value={id} /><button className="btn sm danger" disabled={pending}>Revoke</button><Status state={state} /></form>;
}

export function Seen({ id }: { id: string }) {
  const [state, action, pending] = useActionState<Result, FormData>(seen, null);
  if (state?.ok) return <Status state={state} />;
  return <form action={action}><input type="hidden" name="id" value={id} /><button className="btn sm ok" disabled={pending}>Seen</button><Status state={state} /></form>;
}
