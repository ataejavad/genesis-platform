"use client";

import { useActionState } from "react";
import { agentKey, decide, newJob, type Result } from "./actions";

export function DecideForm({ id, email }: { id: string; email: string }) {
  const [state, action, pending] = useActionState<Result, FormData>(decide, null);
  if (state?.ok) return <span className="badge ok" role="status">{state.message}</span>;
  return (
    <form action={action} className="row" style={{ gap: 6 }}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="email" value={email} />
      <button className="btn sm ok" name="decision" value="accept" disabled={pending}>Accept</button>
      <button className="btn sm danger" name="decision" value="reject" disabled={pending}>Reject</button>
      {state && !state.ok && <span className="badge warn">{state.message}</span>}
    </form>
  );
}

export function JobForm({ skills, customers }: { skills: { id: string; label: string }[]; customers: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<Result, FormData>(newJob, null);
  const due = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  return (
    <form action={action} className="card stack">
      <h3>New job</h3>
      <div className="grid g2">
        <label className="field">Title (partner language)<input name="title" required /></label>
        <label className="field">For customer (white-label; empty = internal)<select name="customer"><option value="">— internal job —</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      </div>
      <label className="field">Brief<textarea name="brief" required /></label>
      <label className="field">Checklist: one acceptance criterion per line<textarea name="checklist" required placeholder={"Test lead arrives in the CRM\nSource field filled"} /></label>
      <fieldset className="row" style={{ flexWrap: "wrap", border: 0, padding: 0, gap: 6 }}><legend className="small">Skills</legend>{skills.map((s) => <label key={s.id} className="choice small" style={{ padding: "4px 10px" }}><input type="checkbox" name="skills" value={s.id} /> {s.label}</label>)}</fieldset>
      <div className="grid g3">
        <label className="field">Pay to partner €<input name="pay" type="number" min={1} required /></label>
        <label className="field">Our price € (optional)<input name="price" type="number" min={0} /></label>
        <label className="field">Due<input name="due" type="date" defaultValue={due} required /></label>
        <label className="field">Language<input name="language" placeholder="it" maxLength={5} /></label>
        <label className="field">Country<input name="country" placeholder="IT" maxLength={2} /></label>
        <label className="row small"><input type="checkbox" name="personal" style={{ width: "auto" }} /> Touches personal data (DPA + EU only)</label>
      </div>
      <div className="row"><button className="btn primary" disabled={pending}>Create job</button>{state && <span className={`badge ${state.ok ? "ok" : "warn"}`} role="status">{state.message}</span>}</div>
    </form>
  );
}

export function KeyForm({ id, has }: { id: string; has: boolean }) {
  const [state, action, pending] = useActionState<Result, FormData>(agentKey, null);
  if (state?.ok) return <code className="small" role="status" style={{ wordBreak: "break-all" }}>{state.message}</code>;
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button className="btn sm" disabled={pending}>{has ? "New key" : "Agent key"}</button>
      {state && <span className="badge warn">{state.message}</span>}
    </form>
  );
}
