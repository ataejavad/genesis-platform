"use client";

import { useActionState } from "react";
import { type OpenState, openAccount } from "./actions";

export function OpenAccount({ industries, products }: { industries: string[]; products: { slug: string; name: string; price: number }[] }) {
  const [state, action, pending] = useActionState<OpenState, FormData>(openAccount, null);
  return (
    <form action={action} className="card stack">
      <h3>Open a customer account</h3>
      <div className="grid g3">
        <label className="field">Company<input name="name" required /></label>
        <label className="field">Contact name<input name="contact" required /></label>
        <label className="field">Login email<input name="email" type="email" required dir="ltr" /></label>
        <label className="field">Country<input name="country" defaultValue="IT" maxLength={2} required /></label>
        <label className="field">Trade<select name="industry">{industries.map((i) => <option key={i}>{i}</option>)}</select></label>
        <label className="field">Language<select name="locale" defaultValue="it"><option>it</option><option>de</option><option>en</option><option>fa</option></select></label>
        <label className="field">Starting loss €/month (check-up)<input name="baseline" inputMode="numeric" /></label>
        <label className="field">First service<select name="product"><option value="">—</option>{products.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></label>
        <label className="field">Fixed fee €/month<input name="fee" inputMode="numeric" /></label>
      </div>
      <div className="row"><button className="btn primary" disabled={pending}>Open account</button>{state && <span className={`badge ${state.ok ? "ok" : "warn"}`} role="status">{state.message}</span>}</div>
    </form>
  );
}
