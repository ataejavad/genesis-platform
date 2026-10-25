import Link from "next/link";
import { getDb } from "@/db";
import { type Brief, buildBrief, latestReport } from "@/server/daily-report";
import { jobBoard } from "@/server/orchestrator";
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
  const jobs = await jobBoard(db, now);
  const failed = jobs.filter((j) => j.ok === false);
  return (
    <main>
      <PageHead title="Today" crumbs="Cockpit" sub={report ? `Brief of ${report.day}${report.sentAt ? " · sent to Telegram" : ""}` : "Live brief (the stored one is built at 08:00)"} actions={<RefreshBrief />} />
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
        <div className="card-head"><h3>Machine</h3><Link className="more" href="/cockpit/agents#jobs">Jobs & agents</Link></div>
        <div className="small">{failed.length ? <span className="badge bad">{failed.length} job(s) failed: {failed.map((j) => j.id).join(", ")}</span> : <span className="badge ok">All {jobs.length} jobs ran fine</span>}</div>
      </div>
    </main>
  );
}
