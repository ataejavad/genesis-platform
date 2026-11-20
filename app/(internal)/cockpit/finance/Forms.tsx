"use client";

import { useActionState } from "react";
import { batchPaid, cancel, company, paid, type Result } from "./actions";

function Status({ state }: { state: Result }) {
  return state ? <span className={`badge ${state.ok ? "ok" : "warn"}`} role="status" style={{ whiteSpace: "normal" }}>{state.message}</span> : null;
}

export function InvoiceActions({ id }: { id: string }) {
  const [s1, a1, p1] = useActionState<Result, FormData>(paid, null);
  const [s2, a2, p2] = useActionState<Result, FormData>(cancel, null);
  if (s1?.ok || s2?.ok) return <Status state={s1?.ok ? s1 : s2} />;
  return (
    <div className="row" style={{ gap: 6 }}>
      <form action={a1}><input type="hidden" name="invoice" value={id} /><button className="btn sm ok" disabled={p1}>Mark paid</button></form>
      <form action={a2}><input type="hidden" name="invoice" value={id} /><button className="btn sm" disabled={p2}>Cancel</button></form>
      <Status state={s1 ?? s2} />
    </div>
  );
}

type Co = { legalName: string | null; vatId: string | null; taxCode: string | null; address: string | null; country: string; iban: string | null; bic: string | null; email: string | null; registered: boolean } | null;

export function CompanyForm({ co }: { co: Co }) {
  const [state, action, pending] = useActionState<Result, FormData>(company, null);
  return (
    <form action={action} className="card stack">
      <h3>Our company (seller on contracts and invoices)</h3>
      <div className="grid g2">
        <label className="field">Legal name<input name="legalName" required defaultValue={co?.legalName ?? ""} /></label>
        <label className="field">Billing email<input name="email" type="email" defaultValue={co?.email ?? ""} /></label>
        <label className="field">VAT (Partita IVA)<input name="vatId" defaultValue={co?.vatId ?? ""} /></label>
        <label className="field">Tax code<input name="taxCode" defaultValue={co?.taxCode ?? ""} /></label>
        <label className="field">IBAN (shown on payment requests and QR)<input name="iban" dir="ltr" defaultValue={co?.iban ?? ""} /></label>
        <label className="field">BIC<input name="bic" dir="ltr" defaultValue={co?.bic ?? ""} /></label>
        <label className="field">Address<input name="address" defaultValue={co?.address ?? ""} /></label>
        <label className="field">Country<input name="country" maxLength={2} defaultValue={co?.country ?? "IT"} /></label>
      </div>
      <label className="row small"><input type="checkbox" name="registered" defaultChecked={co?.registered} style={{ width: "auto" }} /> Business is registered: give paid invoices their legal number (YEAR/0001) from now on</label>
      <div className="row"><button className="btn primary" disabled={pending}>Save</button><Status state={state} /></div>
    </form>
  );
}

export function BatchPaid({ ids }: { ids: string[] }) {
  const [state, action, pending] = useActionState<Result, FormData>(batchPaid, null);
  if (state?.ok) return <Status state={state} />;
  return <form action={action} className="row"><input type="hidden" name="ids" value={ids.join(",")} /><button className="btn sm ok" disabled={pending}>Bank executed it: mark {ids.length} paid</button><Status state={state} /></form>;
}
