"use client";

import { useActionState } from "react";
import { type FindResult, findNow } from "./find";

type Market = { industry: string; country: string; regions: string[] };

/** Cockpit › Outbound: one run of the company finder on the server; every company arrives as drafts below. */
export function FindCustomers({ markets, max, ready }: { markets: Market[]; max: number; ready: string | null }) {
  const [state, action, pending] = useActionState<FindResult, FormData>(findNow, null);
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card-head"><h3>Find customers</h3><span className="more muted small">Google Maps search → score → research → company page + drafts. Nothing is sent before you approve.</span></div>
      {ready ? <p className="small"><span className="badge warn">{ready}</span></p> : null}
      <form action={action} className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <select name="market" defaultValue={markets[0] ? `${markets[0].industry}|${markets[0].regions[0]}` : ""} aria-label="Market and region">
          {markets.flatMap((m) => m.regions.map((r) => <option key={m.industry + r} value={`${m.industry}|${r}`}>{m.industry} · {r} ({m.country})</option>))}
        </select>
        <select name="limit" defaultValue="10" aria-label="How many companies">
          {[5, 10, max].map((n) => <option key={n} value={n}>{n} companies</option>)}
        </select>
        <button className="btn sm primary" disabled={pending || Boolean(ready)}>{pending ? "Searching… (up to 4 min)" : "Find customers now"}</button>
      </form>
      {state && (
        <div className="small" role="status" style={{ marginTop: 10 }}>
          <span className={`badge ${state.ok ? "ok" : "warn"}`} style={{ whiteSpace: "normal" }}>{state.message}</span>
          {state.companies?.length ? (
            <ul className="small" style={{ marginTop: 8 }}>
              {state.companies.map((c) => <li key={c.name}>{c.name} {c.city ? `(${c.city})` : ""} · score {c.score} · {c.status}{c.researched ? " · researched" : ""}</li>)}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
