"use client";

import { useState, useTransition } from "react";
import type { PortalCopy } from "@/config/portal-copy";
import { sendRequest } from "./actions";

/** Request to the team from a page (the same requests the conversation creates). */
export function RequestForm({ t, kinds, prefix = "" }: { t: PortalCopy; kinds: string[]; prefix?: string }) {
  const [kind, setKind] = useState(kinds[0]);
  const [text, setText] = useState(prefix);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const p = t.page.requests;
  return (
    <form className="card stack" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await sendRequest(kind, text); if (r.ok) { setSent(r.text!); setText(prefix); } }); }}>
      {kinds.length > 1 && (
        <label className="field">{p.kind}
          <select value={kind} onChange={(e) => setKind(e.target.value)}>{kinds.map((k) => <option key={k} value={k}>{t.card.kinds[k] ?? k}</option>)}</select>
        </label>
      )}
      <label className="field">{p.text}<textarea value={text} onChange={(e) => { setText(e.target.value); setSent(null); }} required minLength={2} /></label>
      <div className="row"><button className="btn primary" disabled={pending || text.trim().length <= prefix.trim().length + 1}>{p.send}</button>{sent && <span className="badge ok" role="status">✓ {sent}</span>}</div>
    </form>
  );
}

export function RequestButton({ kind, text, label, done }: { kind: string; text: string; label: string; done: string }) {
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  return sent ? <span className="badge ok" role="status">✓ {done}</span> : (
    <button className="btn danger" disabled={pending} onClick={() => start(async () => setSent((await sendRequest(kind, text)).ok))}>{label}</button>
  );
}
