import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { organizations } from "@/db/schema";
import { listOrders, listPackages, listProjects } from "@/server/projects";
import { Progress } from "@/ui/bits";
import { PageHead } from "@/ui/Shell";
import { NewProjectForm, OrderActions } from "./Forms";

const eur = (n: number) => `€${n.toLocaleString("en-GB")}`;
const pct = (n: number | null) => (n === null ? "–" : `${Math.round(n * 100)}%`);

// Step 7: every order becomes a project from a catalogue package; tasks go to partners; milestones to the customer.
export default async function Projects() {
  const db = getDb();
  const [orders, { rows, kpi }, packages, customers] = await Promise.all([
    listOrders(db), listProjects(db), listPackages(db),
    db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(eq(organizations.kind, "customer")),
  ]);
  const pkgTitle = (slug: string) => packages.find((p) => p.slug === slug)?.title ?? slug;
  return (
    <main className="stack">
      <PageHead title="Projects" crumbs="Cockpit › Delivery" sub="Order → project from a package → partners → QA → customer accepts each milestone (invoiceable) → monthly service starts." />
      <section className="grid g4">
        <div className="card stat"><div className="label">From the catalogue</div><div className="value">{pct(kpi.cataloguePct)}</div><div className="delta muted">target 80%+ (else we become an agency)</div></div>
        <div className="card stat"><div className="label">Avg margin (closed)</div><div className="value">{pct(kpi.avgMarginPct)}</div><div className="delta muted">target 30%+</div></div>
        <div className="card stat"><div className="label">Running</div><div className="value">{kpi.running}</div></div>
        <div className="card stat"><div className="label">Need a look</div><div className="value">{kpi.flagged}</div><div className="delta muted">late, budget, margin, waiting</div></div>
      </section>

      <div className="card">
        <h3>New orders ({orders.length})</h3>
        {orders.length === 0 && <p className="muted">None waiting. Orders arrive from the marketplace, the customer dashboard and the CRM.</p>}
        <div className="list">{orders.map(({ order: o, company }) => (
          <div key={o.id} className="item" style={{ flexWrap: "wrap", alignItems: "start" }}>
            <div className="grow"><b>{pkgTitle(o.packageSlug)}</b> <span className="muted small">· {company ?? o.company} · {o.source} · {o.country ?? ""} {o.vat ? `· VAT ${o.vat}` : ""} · {o.createdAt.toISOString().slice(0, 10)}</span>{o.note && <div className="small muted">“{o.note}”</div>}</div>
            <OrderActions id={o.id} email={o.email ?? ""} />
          </div>
        ))}</div>
      </div>

      <div className="card table-wrap">
        <h3>Projects ({rows.length})</h3>
        <table className="table">
          <thead><tr><th>Project</th><th>Package</th><th>Risk</th><th>Status</th><th>Progress</th><th>Price</th><th>Cost</th><th>Margin</th><th>Due</th><th>Look at</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.project.id}>
              <td><Link href={`/cockpit/projects/${r.project.id}`}><b>{r.project.code}</b></Link> {r.project.title}<div className="muted small">{r.company ?? "internal"}</div></td>
              <td className="small">{r.project.packageSlug ?? "custom"}</td>
              <td><span className={`badge ${r.project.risk === "high" ? "bad" : r.project.risk === "medium" ? "warn" : "gray"}`} title={r.project.riskWhy.join(", ")}>{r.project.risk}</span></td>
              <td>{r.project.status}</td>
              <td style={{ width: 110 }}><Progress value={Math.round(r.health.progress * 100)} /></td>
              <td className="num">{eur(r.project.priceEur)}</td>
              <td className="num">{eur(r.costEur)}</td>
              <td className="num">{pct(r.health.marginPct)}</td>
              <td className="small">{r.project.dueAt.toISOString().slice(0, 10)}</td>
              <td className="small">{r.health.flags.map((f) => <div key={f} className="badge warn" style={{ marginBottom: 2 }}>{f}</div>)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <NewProjectForm customers={customers} packages={packages} />
    </main>
  );
}
