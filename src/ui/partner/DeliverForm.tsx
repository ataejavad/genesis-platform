"use client";

import { useState, useTransition } from "react";
import type { PartnerCopy } from "@/config/partner-copy";
import { deliverWork, messageTeam } from "./actions";

/** Delivery with the self-check: every checklist point must be ticked before the button works (pre-QA). A QA job ticks only what passes. */
export function DeliverForm({ jobId, checklist, t, qa = false }: { jobId: string; checklist: string[]; t: PartnerCopy; qa?: boolean }) {
  const p = t.page.work;
  const [checks, setChecks] = useState(checklist.map(() => false));
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (result?.ok) return <span className="badge ok" role="status">✓ {result.text}</span>;
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); start(async () => setResult(await deliverWork(jobId, link, note, checks))); }}>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="stack">
        <legend className="small"><b>{qa ? p.qaHint : p.checklist}</b></legend>
        {checklist.map((c, i) => (
          <label key={c} className="choice small"><input type="checkbox" checked={checks[i]} onChange={() => setChecks((x) => x.map((v, j) => (j === i ? !v : v)))} /> {c}</label>
        ))}
      </fieldset>
      <label className="field">{p.link}<input type="url" required dir="ltr" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} /></label>
      <label className="field">{p.note}<textarea value={note} onChange={(e) => setNote(e.target.value)} style={{ minHeight: 56 }} /></label>
      <div className="row"><button className="btn primary" disabled={pending || (!qa && !checks.every(Boolean)) || !link}>{p.deliver}</button>{result && !result.ok && <span className="badge warn" role="alert">{result.text}</span>}</div>
    </form>
  );
}

export function MessageForm({ t }: { t: PartnerCopy }) {
  const p = t.page.messages;
  const [text, setText] = useState("");
  const [sent, setSent] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="card stack" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await messageTeam(text); setSent(r.text); setText(""); }); }}>
      <label className="field">{p.write}<textarea value={text} onChange={(e) => { setText(e.target.value); setSent(null); }} required /></label>
      <div className="row"><button className="btn primary" disabled={pending || text.trim().length < 2}>{p.send}</button>{sent && <span className="badge ok" role="status">✓ {sent}</span>}</div>
    </form>
  );
}
