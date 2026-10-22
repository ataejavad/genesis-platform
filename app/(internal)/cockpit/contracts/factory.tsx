"use client";

import { useState } from "react";
import { relationships } from "@/mock/cockpit";

// One-click contract (doc 15 §6ج): data + conversations → type + annexes + country pack → 1-page summary → sign.
export function Factory() {
  const [open, setOpen] = useState<number | null>(null);
  const [signed, setSigned] = useState<number[]>([]);
  return (
    <div className="card table-wrap">
      <h3>Relationships</h3>
      <table className="table"><thead><tr><th>Relationship</th><th>Party</th><th>Country</th><th>Data the agent will use</th><th /></tr></thead>
        <tbody>{relationships.map((r, i) => (
          <tr key={r.name}><td>{r.kind}</td><td><b>{r.name}</b></td><td>{r.country}</td><td className="small">{r.data}</td>
            <td>{signed.includes(i) ? <span className="badge ok">✓ sent for e-signature</span> : <button className="btn sm primary" onClick={() => setOpen(i)}>Generate contract</button>}</td></tr>
        ))}</tbody></table>
      {open !== null && (
        <div className="card fade-in" style={{ marginTop: 14, borderColor: "var(--brand)" }}>
          <div className="card-head"><h3>One-page summary · {relationships[open].name}</h3><span className="badge ai">✦ Contract agent</span></div>
          <div className="grid g2">
            <div className="small stack">
              <div><b>Contract:</b> {relationships[open].contract}</div>
              <div><b>Country pack:</b> {relationships[open].country} (governing law, data protection, tax, e-invoice)</div>
              <div><b>We give:</b> scope and deliverables from the approved quote / brief</div>
              <div><b>We get:</b> price, milestones and payment terms from the deal</div>
            </div>
            <div className="small stack">
              <div className="callout warn">⚠️ Deviation: customer asked for liability cap 2× fees (standard 1×). Plain risk: higher exposure if the agent misquotes. Suggest: keep 1×, offer SLA credit instead.</div>
              {relationships[open].kind === "Freelancer" && <div className="callout">✓ Classification check passed: own clients, own hours, own tools (no fake self-employment signals).</div>}
            </div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button className="btn ok" onClick={() => { setSigned((s) => [...s, open]); setOpen(null); }}>Approve & sign (Documenso)</button>
            <button className="btn">Read full text</button>
            <button className="btn">Send to local lawyer</button>
            <button className="btn danger" onClick={() => setOpen(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
