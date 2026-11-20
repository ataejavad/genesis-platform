"use client";

import { useActionState } from "react";
import { agentSwitch, decide, lessonSwitch, refreshBrief, type Result, runJobNow } from "./actions";

function Status({ state }: { state: Result }) {
  return state ? <span className={`badge ${state.ok ? "ok" : "warn"}`} role="status" style={{ whiteSpace: "normal" }}>{state.message}</span> : null;
}

export function AgentControls({ id, enabled, paused, budget }: { id: string; enabled: boolean; paused: boolean; budget: number }) {
  const [state, action, pending] = useActionState<Result, FormData>(agentSwitch, null);
  return (
    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
      <form action={action}><input type="hidden" name="agent" value={id} /><input type="hidden" name="op" value={enabled ? "off" : "on"} /><button className={`btn sm ${enabled ? "danger" : "ok"}`} disabled={pending}>{enabled ? "Switch off" : "Switch on"}</button></form>
      {paused && <form action={action}><input type="hidden" name="agent" value={id} /><input type="hidden" name="op" value="resume" /><button className="btn sm ok" disabled={pending}>Resume</button></form>}
      <form action={action} className="row" style={{ gap: 4 }}><input type="hidden" name="agent" value={id} /><input type="hidden" name="op" value="budget" /><input name="budget" type="number" min={0} max={5000} defaultValue={budget} aria-label="Monthly budget in euro" style={{ width: 70 }} /><button className="btn sm" disabled={pending}>Set €</button></form>
      <Status state={state} />
    </div>
  );
}

export function RunJob({ id }: { id: string }) {
  const [state, action, pending] = useActionState<Result, FormData>(runJobNow, null);
  return <form action={action} className="row" style={{ gap: 6 }}><input type="hidden" name="job" value={id} /><button className="btn sm" disabled={pending}>{pending ? "Running…" : "Run now"}</button><Status state={state} /></form>;
}

export function RefreshBrief() {
  const [state, action, pending] = useActionState<Result, FormData>(refreshBrief, null);
  return <form action={action} className="row" style={{ gap: 6 }}><button className="btn" disabled={pending}>{pending ? "Building…" : "Refresh brief"}</button>{state && !state.ok && <Status state={state} />}</form>;
}

export function Decide({ id, recommended }: { id: string; recommended: string | null }) {
  const [state, action, pending] = useActionState<Result, FormData>(decide, null);
  if (state?.ok) return <Status state={state} />;
  return (
    <form action={action} className="stack" style={{ gap: 6 }}>
      <input type="hidden" name="experiment" value={id} />
      <input name="note" placeholder="What did we learn? (optional, agents read it)" />
      <div className="row" style={{ gap: 6 }}>
        <button className="btn sm ok" name="op" value="adopt" disabled={pending}>Adopt{recommended ? ` "${recommended}"` : ""}</button>
        <button className="btn sm" name="op" value="reject" disabled={pending}>Keep the control</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function LessonSwitch({ id, active }: { id: string; active: boolean }) {
  const [state, action, pending] = useActionState<Result, FormData>(lessonSwitch, null);
  return <form action={action} className="row" style={{ gap: 6 }}><input type="hidden" name="lesson" value={id} /><input type="hidden" name="op" value={active ? "off" : "on"} /><button className="btn sm" disabled={pending}>{active ? "Retire" : "Use again"}</button><Status state={state} /></form>;
}
