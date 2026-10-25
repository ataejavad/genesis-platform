import Link from "next/link";
import { getDb } from "@/db";
import { type Brief, buildBrief, latestReport } from "@/server/daily-report";
import { sum, eq } from "drizzle-orm";
import { NORTH_STAR } from "@/config/goals";
import { subscriptions } from "@/db/schema";
import { jobBoard } from "@/server/orchestrator";
import { systemsBoard } from "@/server/systems";
import { Progress } from "@/ui/bits";
import { PageHead } from "@/ui/Shell";
import { Stat } from "@/ui/bits";
import { RefreshBrief } from "./agents/Forms";

const TONE = { green: "", yellow: "warn", red: "warn" } as const;

// Today: the morning brief (built 08:00 Rome, also sent to Telegram): verdict, five numbers, decisions, stuck items.
export default async function Today() {
  const db = getDb();
  const now = new Date();
  const report = await latestReport(db);
  // before the first 08:00 run there is no stored brief: show a live one
  const brief = (report?.body as Brief | undefined) ?? (await buildBrief(db, now));
  const [jobs, systems, [mrrRow]] = await Promise.all([jobBoard(db, now), systemsBoard(db, now), db.select({ v: sum(subscriptions.monthlyEur) }).from(subscriptions).where(eq(subscriptions.status, "active"))]);
  const failed = jobs.filter((j) => j.ok === false);
  const mrr = Number(mrrRow?.v ?? 0);
  return (
    <main>
      <PageHead title="Today" crumbs="Cockpit" sub={report ? `Brief of ${report.day}${report.sentAt ? " · sent to Telegram" : ""}` : "Live brief (the stored one is built at 08:00)"} actions={<RefreshBrief />} />
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row" style={{ justifyContent: "space-between" }}><b>North star: {NORTH_STAR.label}</b><span className="num"><b>€{mrr.toLocaleString("en-GB")}</b> <span className="muted">of €{NORTH_STAR.goalEur.toLocaleString("en-GB")}</span></span></div>
        <Progress value={Math.min(100, Math.round((mrr / NORTH_STAR.goalEur) * 100))} />
      </div>
      {systems.stopped && <div className="callout warn" style={{ marginBottom: 18 }}>⛔ <b>Emergency stop is on.</b> <Link href="/cockpit/systems">Lift it in Systems</Link></div>}
      <div className={`callout ${TONE[brief.level]}`} style={{ marginBottom: 18, fontSize: 18 }}>{brief.level === "green" ? "🟢" : brief.level === "yellow" ? "🟡" : "🔴"} <b>{brief.verdict}</b></div>
      <section className="grid g4" style={{ marginBottom: 18 }}>
        {brief.numbers.map((n) => <Stat key={n.label} label={n.label} value={n.value} />)}
      </section>
      <section className="grid g2" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card-head"><h3>✋ Your decisions</h3></div>
          <div className="list">{brief.decisions.map((d) => <div key={d.text} className="item"><div className="grow small">{d.text}</div><Link className="btn sm" href={d.link}>Open</Link></div>)}
            {!brief.decisions.length && <div className="muted small">Nothing waits for you.</div>}
            {brief.decisionsMore > 0 && <div className="muted small">… and {brief.decisionsMore} more</div>}</div>
        </div>
        <div className="card">
          <div className="card-head"><h3>⏳ Stuck</h3></div>
          <div className="list">{brief.stuck.map((s) => <div key={s.text} className="item"><div className="grow small">{s.text}</div><Link className="btn sm" href={s.link}>Open</Link></div>)}
            {!brief.stuck.length && <div className="muted small">Nothing stuck.</div>}
            {brief.stuckMore > 0 && <div className="muted small">… and {brief.stuckMore} more</div>}</div>
        </div>
      </section>
      <div className="card">
        <div className="card-head"><h3>Machine</h3><Link className="more" href="/cockpit/systems">All {systems.total} modules</Link></div>
        <div className="row small" style={{ gap: 8, flexWrap: "wrap" }}>
          {systems.systems.map((s) => <Link key={s.id} href={`/cockpit/systems#${s.id}`} className={`badge ${s.light === "green" ? "ok" : s.light === "amber" ? "warn" : "bad"}`}>{s.name}</Link>)}
        </div>
        <div className="small" style={{ marginTop: 8 }}>{failed.length ? <span className="badge bad">{failed.length} job(s) failed: {failed.map((j) => j.id).join(", ")}</span> : <span className="badge ok">All {jobs.length} jobs ran fine</span>} <span className="muted">· {systems.counts.live ?? 0} live · {systems.counts.key ?? 0} waiting for a key</span></div>
      </div>
    </main>
  );
}
