import Link from "next/link";
import { STEPS } from "@/config/process-map";
import { getDb } from "@/db";
import { type Status, systemsBoard } from "@/server/systems";
import { PageHead } from "@/ui/Shell";
import { AgentControls, RunJob } from "../agents/Forms";
import { agentBoard } from "@/server/agents";
import { jobBoard } from "@/server/orchestrator";
import { EmergencyStop, JobSwitch } from "./Forms";

const LIGHT = { green: "🟢", amber: "🟡", red: "🔴" } as const;
const BADGE: Record<Status, [string, string]> = {
  live: ["ok", "live"], key: ["warn", "waiting for key"], off: ["gray", "off"], paused: ["warn", "paused"], stopped: ["bad", "stopped"], failing: ["bad", "failing"], manual: ["", "manual run"],
};
const when = (d: Date | null) => (d ? d.toISOString().slice(0, 16).replace("T", " ") : "–");

// Systems (step 10): the whole machine, one row per module from steps 1–9 (docs/cockpit-wiring.md), with its control.
export default async function Systems() {
  const db = getDb();
  const now = new Date();
  const [board, agents, jobs] = await Promise.all([systemsBoard(db, now), agentBoard(db, now), jobBoard(db, now)]);
  const gaps = STEPS.filter((s) => s.gap).sort((a, b) => (a.impact ?? 3) - (b.impact ?? 3));
  return (
    <main>
      <PageHead title="Systems" crumbs="Cockpit › Machine" sub={`${board.total} modules from steps 1–9. Status comes from the agents, the job log, the events and the .env keys; nothing is typed by hand.`} actions={<EmergencyStop stopped={board.stopped} />} />
      {board.stopped && <div className="callout warn" style={{ marginBottom: 18 }}>⛔ <b>Emergency stop is on.</b> Agents and everything that reaches people outside (outreach, reminders, emails) are held. Watchdogs and billing keep running.</div>}
      <section className="grid g4" style={{ marginBottom: 18 }}>
        {board.systems.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="card" style={{ textDecoration: "none" }}>
            <div className="row" style={{ justifyContent: "space-between" }}><b>{LIGHT[s.light]} {s.name}</b><span className="muted small">{s.rows.length}</span></div>
            <div className="muted small" style={{ marginTop: 6 }}>{s.rows.filter((r) => r.status === "live").length} live · {s.rows.filter((r) => r.status === "key").length} waiting for a key{s.rows.some((r) => r.status === "failing") ? ` · ${s.rows.filter((r) => r.status === "failing").length} failing` : ""}</div>
          </a>
        ))}
      </section>
      {board.systems.map((s) => (
        <div key={s.id} id={s.id} className="card table-wrap" style={{ marginBottom: 18 }}>
          <h3>{LIGHT[s.light]} {s.name}</h3>
          <table className="table"><thead><tr><th>#</th><th>Module</th><th>Status</th><th>Last activity</th><th>€ month</th><th>KPI</th><th>Control</th></tr></thead>
            <tbody>{s.rows.map((r) => {
              const a = r.agent ? agents.find((x) => x.def.id === r.agent) : undefined;
              const j = r.job ? jobs.find((x) => x.id === r.job) : undefined;
              return (
                <tr key={r.n}>
                  <td className="muted small">{r.n}</td>
                  <td><b>{r.name}</b><div className="muted small">{r.runs}</div></td>
                  <td><span className={`badge ${BADGE[r.status][0]}`}>{BADGE[r.status][1]}</span>{r.why && <div className="muted small" style={{ maxWidth: 220 }}>{r.why}</div>}</td>
                  <td className="small">{when(r.lastAt)}</td>
                  <td className="num">{r.costEur === null ? "–" : `€${r.costEur.toFixed(2)}`}</td>
                  <td className="small">{r.kpiText}</td>
                  <td>
                    <div className="stack" style={{ gap: 6 }}>
                      {a && <AgentControls id={a.def.id} enabled={a.enabled} paused={a.paused} budget={a.budgetEur} />}
                      {j && <div className="row" style={{ gap: 6 }}><JobSwitch id={j.id} enabled={j.enabled} /><RunJob id={j.id} /></div>}
                      <Link className="btn sm" href={r.link}>Open</Link>
                    </div>
                  </td>
                </tr>
              );
            })}</tbody></table>
        </div>
      ))}
      <div id="audit" className="card table-wrap">
        <h3>Process audit: open gaps</h3>
        <p className="muted small">From the process map, checked on every push (npm run audit:process). 1 = costs customers or money now.</p>
        <table className="table"><thead><tr><th>Impact</th><th>Step</th><th>Who → whom</th><th>Gap</th></tr></thead>
          <tbody>{gaps.map((g) => <tr key={g.id}><td><span className={`badge ${g.impact === 1 ? "bad" : g.impact === 2 ? "warn" : "gray"}`}>{g.impact ?? 3}</span></td><td className="small"><b>{g.id}</b></td><td className="small">{g.edge}</td><td className="small">{g.gap}</td></tr>)}</tbody></table>
      </div>
    </main>
  );
}
