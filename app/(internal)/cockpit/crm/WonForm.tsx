"use client";

import Link from "next/link";
import { useActionState } from "react";
import { won, type Result } from "./actions";

export function WonForm({ prospect, packages }: { prospect: string; packages: { slug: string; title: string; setupEur: number; monthlyEur: number }[] }) {
  const [state, action, pending] = useActionState<Result, FormData>(won, null);
  if (state?.ok) return <span className="badge ok" role="status">{state.message} <Link href="/cockpit/projects">Open</Link></span>;
  return (
    <form action={action} className="row" style={{ gap: 6 }}>
      <input type="hidden" name="prospect" value={prospect} />
      <select name="package" required>{packages.map((p) => <option key={p.slug} value={p.slug}>{p.title} · €{p.setupEur} + €{p.monthlyEur}/mo</option>)}</select>
      <button className="btn ok" disabled={pending}>Won → order</button>
      {state && <span className="badge warn" role="status">{state.message}</span>}
    </form>
  );
}
