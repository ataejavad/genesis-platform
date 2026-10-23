import { agents, kpis, stages } from "@/mock/cockpit";
import { PageHead } from "@/ui/Shell";
import { Progress } from "@/ui/bits";
import { ActionButton } from "@/ui/site/SiteClient";

const levels = ["", "L1 · suggest only", "L2 · act with approval", "L3 · autonomous"];
const stateLabel: Record<string, string> = { on: "running", wait: "waiting for approval", err: "error" };

// Agent center (doc 15 §6ز): a THIN control plane. Runs, status and history come from n8n; traces, cost,
// prompt versions and A/B from Langfuse. Our own code: autonomy level, budget, hard limits, links to customers.
export default function AgentCenter() {
  const spend = agents.reduce((s, a) => s + a.cost, 0);
  return (
    <main>
      <PageHead title="Agent center" crumbs="Cockpit › Machine" sub="Every agent has a file, a level of autonomy, a budget and a score. Execution runs in n8n + Claude API." actions={<><a className="btn" href="#">Open n8n ↗</a><a className="btn" href="#">Open Langfuse ↗</a><ActionButton className="btn danger" label="⏹ Emergency stop (all)" done="All agents paused · API keys disabled" /></>} />

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head"><h3>Live map</h3><div className="legend more"><span><i style={{ background: "var(--ok)" }} />running</span><span><i style={{ background: "var(--warn)" }} />waiting for you</span><span><i style={{ background: "var(--bad)" }} />error / stopped</span><span>✋ your approval point</span></div></div>
        <div className="flow" dir="ltr">
          {stages.map((s, i) => (
            <div key={s} className="stage">
              <h4>{s}</h4>
              {agents.filter((a) => a.stage === i).map((a) => (
                <div key={a.id}>
                  <a href={`#${a.id}`} className={`node ${a.state}`}><b>{a.name}</b><div className="muted small">{a.kpi}</div></a>
                  {a.gate && <div className="gate">✋ {a.gate}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="muted small" style={{ marginTop: 8 }}>Hand-offs run left to right: market → leads & personas → content & hubs → concierge, check-up, offer, contract → planning, delivery, QA → advisor & reports. The orchestrator watches all of them.</p>
      </div>

      <section className="grid g3" style={{ marginBottom: 18 }}>
        <div className="card"><h3>Budget</h3><div className="row"><b className="num">€{spend.toFixed(2)}</b><span className="muted">of €{kpis.aiBudget} / month</span></div><Progress value={Math.round((spend / kpis.aiBudget) * 100)} /><p className="muted small" style={{ marginTop: 6 }}>Alert at 80%; at 100% non-essential runs stop.</p></div>
        <div className="card"><h3>Autonomy levels</h3><ol className="small" style={{ margin: 0 }}><li>Suggest only</li><li>Act with approval</li><li>Autonomous</li></ol><p className="muted small">New agents start at L1; promotion on KPIs + your approval.</p></div>
        <div className="card"><h3>Never autonomous</h3><ul className="small" style={{ margin: 0 }}><li>Paying money</li><li>Signing contracts</li><li>Deleting data</li><li>First message to a new company</li></ul><p className="muted small">Enforced by API-key scopes, not just prompts.</p></div>
      </section>

      <div className="card table-wrap">
        <table className="table"><thead><tr><th>Agent</th><th>Stage</th><th>State</th><th>Autonomy</th><th>Runs</th><th>Cost (month)</th><th>KPI</th><th /></tr></thead>
          <tbody>{agents.map((a) => (
            <tr key={a.id} id={a.id}><td><b>{a.name}</b></td><td className="small">{stages[a.stage]}</td><td><span className={`badge ${a.state === "on" ? "ok" : a.state === "wait" ? "warn" : "bad"}`}>{stateLabel[a.state]}</span></td>
              <td><select defaultValue={a.level} style={{ width: "auto" }}>{[1, 2, 3].map((l) => <option key={l} value={l}>{levels[l]}</option>)}</select></td>
              <td className="num">{a.runs}</td><td className="num">€{a.cost.toFixed(2)}</td><td className="small">{a.kpi}</td>
              <td><div className="row"><a className="btn sm" href="#">Traces ↗</a><ActionButton className="btn sm danger" label="Stop" done="stopped" /></div></td></tr>
          ))}</tbody></table>
      </div>
    </main>
  );
}
