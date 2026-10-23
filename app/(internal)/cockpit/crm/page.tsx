import Link from "next/link";
import { getDb } from "@/db";
import { STAGES, channelStats, crmFunnel, listProspects, priority, stageCounts } from "@/server/crm";
import { PageHead } from "@/ui/Shell";

export const dynamic = "force-dynamic";

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 1000) / 10}%`);
const eur = (n: number | null) => (n === null ? "—" : `€${n.toFixed(2)}`);

/** CRM (step 4): every company, outbound and inbound, with the funnel and what it costs to win one. */
export default async function Crm({ searchParams }: { searchParams: Promise<{ stage?: string; industry?: string }> }) {
  const filter = await searchParams;
  const db = getDb();
  const [rows, counts, funnel, channels] = await Promise.all([listProspects(db, filter), stageCounts(db), crmFunnel(db), channelStats(db)]);
  const now = new Date();
  return (
    <main>
      <PageHead title="CRM" crumbs="Cockpit › Growth" sub="One row per company. Outbound comes from the company agent; inbound from hubs, the check-up and WhatsApp. Stages only move forward." actions={<Link className="btn primary" href="/cockpit/outreach">Outbound queue →</Link>} />

      <div className="row" style={{ gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        <Link className="chip" href="/cockpit/crm">All</Link>
        {STAGES.map((s) => <Link key={s} className="chip" aria-pressed={filter.stage === s} href={`/cockpit/crm?stage=${s}`}>{s.replace(/_/g, " ")} <b>{counts[s] ?? 0}</b></Link>)}
      </div>

      <section className="grid g2" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card-head"><h3>Outbound funnel</h3><span className="badge ok">live</span><span className="more muted small">Targets: reply ≥ 5%, interest ≥ 30%, win ≥ 20%</span></div>
          <table className="table"><thead><tr><th>Industry</th><th>Companies</th><th>Contacted</th><th>Replied</th><th>Interested</th><th>Meetings</th><th>Won</th><th>What to fix</th></tr></thead>
            <tbody>{funnel.outbound.length === 0 ? <tr><td colSpan={8} className="muted small">No outbound companies yet.</td></tr> : funnel.outbound.map((r) => (
              <tr key={r.industry}><td>{r.industry}</td><td className="num">{r.companies}</td><td className="num">{r.contacted}</td><td className="num">{r.replied} <span className="muted small">{pct(r.diagnosis.rates.reply)}</span></td><td className="num">{r.interested}</td><td className="num">{r.meetings}</td><td className="num">{r.won}</td><td className="small">{r.diagnosis.reason}</td></tr>
            ))}</tbody></table>
          <p className="small muted">Agent cost so far {eur(funnel.costEur)} · cost per customer (agents only) {eur(funnel.cacEur)} · inbound: {funnel.inbound.map((i) => `${i.industry} ${i.companies}`).join(", ") || "none yet"}</p>
        </div>
        <div className="card">
          <div className="card-head"><h3>Channels</h3><span className="more muted small">Downgrade after 200 touches below a 5% reply rate</span></div>
          <table className="table"><thead><tr><th>Channel</th><th>Done</th><th>Replies</th><th>Rate</th><th /></tr></thead>
            <tbody>{channels.map((c) => <tr key={c.channel}><td>{c.channel}</td><td className="num">{c.done}</td><td className="num">{c.replies}</td><td className="num">{pct(c.rate)}</td><td>{c.downgrade ? <span className="badge bad">downgrade</span> : null}</td></tr>)}</tbody></table>
        </div>
      </section>

      <div className="card table-wrap">
        <table className="table"><thead><tr><th>Company</th><th>Industry</th><th>Source</th><th>Tier</th><th>Score</th><th>Stage</th><th>Next step</th></tr></thead>
          <tbody>{rows.length === 0 ? <tr><td colSpan={7} className="muted small">No companies yet.</td></tr> : rows.map((p) => (
            <tr key={p.id}>
              <td><Link href={`/cockpit/crm/${p.id}`}><b>{p.name}</b></Link><div className="muted small">{[p.city, p.region].filter(Boolean).join(", ")}</div></td>
              <td>{p.industry}</td><td>{p.source}</td><td><span className="badge">T{priority(p, now).tier}</span></td><td className="num">{p.score ?? "—"}</td><td>{p.stage.replace(/_/g, " ")}</td>
              <td className="small">{p.nextAt ? p.nextAt.toISOString().slice(0, 10) : "—"}</td>
            </tr>
          ))}</tbody></table>
      </div>
    </main>
  );
}
