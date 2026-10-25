"use client";

import { useActionState } from "react";
import { approveProtocol, convert, draftProtocol, newProject, qaDecide, quote, reject, type Result } from "./actions";

function Status({ state }: { state: Result }) {
  return state ? <span className={`badge ${state.ok ? "ok" : "warn"}`} role="status" style={{ whiteSpace: "normal" }}>{state.message}</span> : null;
}

export function OrderActions({ id, email }: { id: string; email: string }) {
  const [s1, a1, p1] = useActionState<Result, FormData>(convert, null);
  const [s2, a2, p2] = useActionState<Result, FormData>(reject, null);
  if (s1?.ok || s2?.ok) return <Status state={s1?.ok ? s1 : s2} />;
  return (
    <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
      <form action={a1}><input type="hidden" name="order" value={id} /><input type="hidden" name="email" value={email} /><button className="btn sm ok" disabled={p1}>Start project</button></form>
      <form action={a2}><input type="hidden" name="order" value={id} /><button className="btn sm" disabled={p2}>Reject</button></form>
      <Status state={s1 ?? s2} />
    </div>
  );
}

export function NewProjectForm({ customers, packages }: { customers: { id: string; name: string }[]; packages: { slug: string; title: string; setupEur: number; monthlyEur: number }[] }) {
  const [state, action, pending] = useActionState<Result, FormData>(newProject, null);
  return (
    <form action={action} className="card stack">
      <h3>New project from a package</h3>
      <div className="grid g3">
        <label className="field">Package<select name="package" required>{packages.map((p) => <option key={p.slug} value={p.slug}>{p.title} · €{p.setupEur} + €{p.monthlyEur}/mo</option>)}</select></label>
        <label className="field">Customer<select name="customer"><option value="">— internal project —</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="row small" style={{ alignSelf: "end" }}><input type="checkbox" name="sensitive" style={{ width: "auto" }} /> Sensitive data (health, finance) → high risk</label>
      </div>
      <div className="row"><button className="btn primary" disabled={pending}>Start project</button><Status state={state} /></div>
    </form>
  );
}

export function ChangeForm({ project }: { project: string }) {
  const [state, action, pending] = useActionState<Result, FormData>(quote, null);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="project" value={project} />
      <label className="field">What changes<textarea name="text" required style={{ minHeight: 56 }} /></label>
      <div className="grid g2"><label className="field">Extra price €<input name="price" type="number" min={0} required /></label><label className="field">Extra days<input name="days" type="number" min={0} required /></label></div>
      <div className="row"><button className="btn sm primary" disabled={pending}>Send to customer</button><Status state={state} /></div>
    </form>
  );
}

export function ApproveVersion({ id }: { id: string }) {
  const [state, action, pending] = useActionState<Result, FormData>(approveProtocol, null);
  if (state?.ok) return <Status state={state} />;
  return <form action={action} className="row"><input type="hidden" name="version" value={id} /><button className="btn sm ok" disabled={pending}>Approve</button><Status state={state} /></form>;
}

export function DraftForm({ protocol, v }: { protocol: string; v: { goal: string; inputs: string[]; deliverables: string[]; criteria: { text: string; mandatory: boolean; method: string }[]; guidance: string | null; standardDays: number } }) {
  const [state, action, pending] = useActionState<Result, FormData>(draftProtocol, null);
  return (
    <form action={action} className="card stack">
      <h3>New draft version</h3>
      <input type="hidden" name="protocol" value={protocol} />
      <label className="field">Measurable goal<textarea name="goal" defaultValue={v.goal} required style={{ minHeight: 48 }} /></label>
      <div className="grid g2">
        <label className="field">Inputs (one per line)<textarea name="inputs" defaultValue={v.inputs.join("\n")} /></label>
        <label className="field">Deliverables (one per line)<textarea name="deliverables" defaultValue={v.deliverables.join("\n")} required /></label>
      </div>
      <label className="field">Acceptance criteria: one per line, “! judge …” mandatory, “? human …” optional; checked by auto, judge or human. Say what and how well, never how or when (freelancers choose their method).
        <textarea name="criteria" defaultValue={v.criteria.map((c) => `${c.mandatory ? "!" : "?"} ${c.method} ${c.text}`).join("\n")} required style={{ minHeight: 120 }} />
      </label>
      <label className="field">How we usually do it (advice only for freelancers)<textarea name="guidance" defaultValue={v.guidance ?? ""} /></label>
      <div className="grid g2"><label className="field">Standard days<input name="days" type="number" min={1} defaultValue={v.standardDays} required /></label><label className="field">What changed and why<input name="note" required /></label></div>
      <div className="row"><button className="btn primary" disabled={pending}>Save draft</button><Status state={state} /></div>
    </form>
  );
}

export function QaForm({ delivery, criteria, judge }: { delivery: string; criteria: { text: string; mandatory: boolean; method: string }[]; judge: { idx: number; result: string; note?: string }[] | null }) {
  const [state, action, pending] = useActionState<Result, FormData>(qaDecide, null);
  if (state?.ok) return <Status state={state} />;
  return (
    <form action={action} className="stack">
      <input type="hidden" name="delivery" value={delivery} /><input type="hidden" name="n" value={criteria.length} />
      <table className="table">
        <thead><tr><th>Criterion</th><th>Judge</th><th>Your check</th></tr></thead>
        <tbody>{criteria.map((c, i) => {
          const j = judge?.find((x) => x.idx === i);
          return (
            <tr key={i}>
              <td className="small">{c.mandatory ? <b>{c.text}</b> : c.text} <span className="muted">· {c.method}{c.mandatory ? "" : " · optional"}</span></td>
              <td className="small">{j ? <span className={`badge ${j.result === "pass" ? "ok" : j.result === "fail" ? "bad" : "gray"}`} title={j.note}>{j.result}</span> : "–"}</td>
              <td><select name={`c${i}`} defaultValue={j?.result === "fail" ? "fail" : "pass"} aria-label={`Check: ${c.text}`} style={{ width: "auto" }}><option value="pass">pass</option><option value="fail">fail</option></select></td>
            </tr>
          );
        })}</tbody>
      </table>
      <div className="row" style={{ flexWrap: "wrap" }}>
        <label className="field" style={{ width: 110 }}>Quality<select name="quality" defaultValue="4">{[5, 4, 3, 2, 1].map((q) => <option key={q}>{q}</option>)}</select></label>
        <label className="field grow">Note for the partner<input name="note" placeholder="What to fix, or a thank-you" /></label>
        <button className="btn primary" disabled={pending} style={{ alignSelf: "end" }}>Decide</button>
      </div>
      <Status state={state} />
    </form>
  );
}
