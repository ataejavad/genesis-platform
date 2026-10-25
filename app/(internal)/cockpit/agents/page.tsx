import { getDb } from "@/db";
import { agentBoard, monthSpend } from "@/server/agents";
import { jobBoard } from "@/server/orchestrator";
import { PageHead } from "@/ui/Shell";
import { Progress } from "@/ui/bits";
import { JobSwitch } from "../systems/Forms";
import { AgentControls, RunJob } from "./Forms";

const when = (d: Date | null) => (d ? d.toISOString().slice(0, 16).replace("T", " ") : "never");
const val = (v: number | null, unit: string) => (v === null ? "–" : unit === "€" ? `€${v}` : `${v}%`);

// Agent center (step 9, value filter): every agent with its job, KPI against target, € against budget, runs and
// Javad's switches. The jobs the orchestrator runs are listed below with their last result and a "run now".
export default async function AgentCenter() {
  const db = getDb();
  const now = new Date();
  const [board, spend, jobs] = await Promise.all([agentBoard(db, now), monthSpend(db, now), jobBoard(db, now)]);
  const budget = board.reduce((s, a) => s + a.budgetEur, 0);
  return (
    <main>
      <PageHead title="Agent center" crumbs="Cockpit › Machine" sub="Every agent has one KPI tied to customers or cost, a monthly budget and a switch. Over budget it rests until the 1st; under target for two weeks it lands in your brief." />
      <section className="grid g3" style={{ marginBottom: 18 }}>
        <div className="card"><h3>AI spend this month</h3><div className="row"><b className="num">€{spend.toFixed(2)}</b><span className="muted">of €{budget} budgets</span></div><Progress value={budget ? Math.min(100, Math.round((spend / budget) * 100)) : 0} /></div>
        <div className="card"><h3>Rules</h3><ul className="small" style={{ margin: 0 }}><li>Budget reached → paused until the 1st</li><li>KPI missed 2 weeks with spend → your decision</li><li>Switched off → the feature falls back to rules</li></ul></div>
        <div className="card"><h3>Never autonomous</h3><ul className="small" style={{ margin: 0 }}><li>Paying money, signing contracts</li><li>Deleting data</li><li>First message to a new company</li></ul><p className="muted small">Enforced by API-key scopes and approvals.</p></div>
      </section>

      <div className="card table-wrap" style={{ marginBottom: 18 }}>
        <h3>Agents</h3>
        <table className="table"><thead><tr><th>Agent</th><th>State</th><th>KPI (14 days)</th><th>Before</th><th>€ month</th><th>Runs 30d</th><th>Last run</th><th /></tr></thead>
          <tbody>{board.map((a) => (
            <tr key={a.def.id}>
              <td><b>{a.def.name}</b><div className="muted small">{a.def.job} · {a.def.runs}</div>{a.decision && <div className="callout warn small" style={{ marginTop: 6 }}>{a.decision}</div>}</td>
              <td><span className={`badge ${!a.enabled ? "gray" : a.paused ? "warn" : "ok"}`}>{!a.enabled ? "off" : a.paused ? `paused to ${a.pausedUntil?.toISOString().slice(0, 10)}` : "on"}</span></td>
              <td className="small"><span className={`badge ${a.kpi.value === null ? "gray" : a.kpi.met ? "ok" : "bad"}`}>{val(a.kpi.value, a.def.kpi.unit)}</span><div className="muted">{a.def.kpi.label}, target {a.def.kpi.better === "lower" ? "≤" : "≥"} {val(a.def.kpi.target, a.def.kpi.unit)} · n {a.kpi.n}</div></td>
              <td className="small">{val(a.prevKpi.value, a.def.kpi.unit)}</td>
              <td className="num">€{a.spentEur.toFixed(2)} <span className="muted small">/ €{a.budgetEur}</span><Progress value={a.budgetEur ? Math.min(100, Math.round((a.spentEur / a.budgetEur) * 100)) : 0} /></td>
              <td className="num">{a.runs30}{a.failed30 ? <span className="badge bad" style={{ marginLeft: 4 }}>{a.failed30} failed</span> : null}</td>
              <td className="small">{when(a.lastRun)}</td>
              <td><AgentControls id={a.def.id} enabled={a.enabled} paused={a.paused} budget={a.budgetEur} /></td>
            </tr>
          ))}</tbody></table>
      </div>

      <div className="card table-wrap" id="jobs">
        <h3>Orchestrator jobs</h3>
        <p className="muted small">One list for everything that runs on its own (Rome time). A failed job is retried after 15 minutes.</p>
        <table className="table"><thead><tr><th>Job</th><th>When</th><th>Last run</th><th>Result</th><th /></tr></thead>
          <tbody>{jobs.map((j) => (
            <tr key={j.id}>
              <td><b>{j.id}</b>{!j.enabled && <span className="badge gray" style={{ marginLeft: 4 }}>off</span>}{j.outward && <span className="badge" style={{ marginLeft: 4 }} title="held by the emergency stop">outward</span>}<div className="muted small">{j.what}</div></td>
              <td className="small">{j.when}</td>
              <td className="small">{when(j.lastAt)} {j.ok === null ? null : <span className={`badge ${j.ok ? "ok" : "bad"}`}>{j.ok ? "ok" : "failed"}</span>}</td>
              <td className="small muted" style={{ maxWidth: 320, wordBreak: "break-word" }}>{j.error ?? (j.result ? JSON.stringify(j.result).slice(0, 160) : "–")}</td>
              <td><div className="row" style={{ gap: 6 }}><JobSwitch id={j.id} enabled={j.enabled} /><RunJob id={j.id} /></div></td>
            </tr>
          ))}</tbody></table>
      </div>
    </main>
  );
}
