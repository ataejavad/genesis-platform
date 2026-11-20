"use client";

import { useActionState } from "react";
import { erase, type OpenState } from "./actions";

/** Irreversible: Javad types the company name to confirm. */
export function EraseForm({ org, request, company }: { org: string; request: string; company: string }) {
  const [state, action, pending] = useActionState<OpenState, FormData>(erase, null);
  if (state?.ok) return <span className="badge ok" role="status">{state.message}</span>;
  return (
    <form action={action} className="row" style={{ gap: 6, flexBasis: "100%" }}>
      <input type="hidden" name="org" value={org} /><input type="hidden" name="request" value={request} /><input type="hidden" name="company" value={company} />
      <input name="confirm" placeholder={`Type “${company}” to erase their personal data`} style={{ minWidth: 280 }} />
      <button className="btn sm" style={{ color: "var(--bad)" }} disabled={pending}>Erase data (cannot be undone)</button>
      {state && <span className="badge warn" role="status">{state.message}</span>}
    </form>
  );
}
