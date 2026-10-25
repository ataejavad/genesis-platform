import { getDb } from "@/db";
import { listExperiments, listLessons } from "@/server/improve";
import { PageHead } from "@/ui/Shell";
import { Decide, LessonSwitch } from "../agents/Forms";

const pct = (r: number) => `${Math.round(r * 1000) / 10}%`;
const BADGE: Record<string, string> = { running: "", ready: "warn", adopted: "ok", rejected: "gray", stopped: "gray" };

// Improvement loop (principle 2): goal metric → experiment → measure → adopt + lesson. Javad decides; agents read the lessons.
export default async function Experiments() {
  const db = getDb();
  const [exps, lessons] = await Promise.all([listExperiments(db), listLessons(db)]);
  return (
    <main>
      <PageHead title="Experiments & lessons" crumbs="Cockpit › Machine" sub="Each test compares a new way with the current one on a real result. A winner needs a clear lead (95% one-sided) and must not raise opt-outs. What we learn is stored and read by the agents of that area." />
      <div className="stack" style={{ marginBottom: 18 }}>
        {exps.map((e) => {
          const r = e.result as { winner?: string; why?: string; note?: string | null } | null;
          return (
            <div key={e.id} className="card">
              <div className="card-head"><h3>{e.key}</h3><span className={`badge ${BADGE[e.status] ?? ""}`}>{e.status}</span></div>
              <p className="small" style={{ marginTop: 0 }}>{e.hypothesis}</p>
              <div className="muted small">Metric: {e.metric}{e.guardrail ? ` · guardrail: ${e.guardrail}` : ""} · min {e.minSample} per arm · window {e.windowDays} days</div>
              <table className="table" style={{ marginTop: 8 }}><thead><tr><th>Variant</th><th>Closed</th><th>Success</th><th>Rate</th><th>Guardrail</th></tr></thead>
                <tbody>{e.arms.map((a, i) => <tr key={a.id}><td><b>{a.id}</b>{i === 0 && <span className="badge gray" style={{ marginLeft: 4 }}>control</span>}<div className="muted small">{a.description}</div></td><td className="num">{a.n} / {e.minSample}</td><td className="num">{a.successes}</td><td className="num">{a.n ? pct(a.rate) : "–"}</td><td className="num">{a.n ? pct(a.guardrailRate) : "–"}</td></tr>)}</tbody></table>
              {r?.why && <div className="callout small" style={{ marginTop: 8 }}>{r.why}{r.note ? ` · ${r.note}` : ""}</div>}
              {(e.status === "ready" || e.status === "running") && <div style={{ marginTop: 8 }}>{e.status === "running" && <p className="muted small">Still collecting. You can stop it early; the control stays.</p>}<Decide id={e.id} recommended={e.status === "ready" ? (r?.winner ?? null) : null} /></div>}
            </div>
          );
        })}
        {!exps.length && <div className="card muted">No experiments yet. They start from src/config/experiments.ts at 07:30.</div>}
      </div>
      <div className="card table-wrap">
        <h3>Lessons</h3>
        <p className="muted small">From decided tests, your rejection notes on content, and closed projects. Agents read the newest active ones of their area.</p>
        <table className="table"><thead><tr><th>Area</th><th>Lesson</th><th>From</th><th>Date</th><th /></tr></thead>
          <tbody>{lessons.map((l) => <tr key={l.id} style={{ opacity: l.active ? 1 : 0.5 }}><td><span className="badge gray">{l.area}</span></td><td className="small">{l.text}</td><td className="small muted">{l.source.split(":")[0]}</td><td className="small">{l.createdAt.toISOString().slice(0, 10)}</td><td><LessonSwitch id={l.id} active={l.active} /></td></tr>)}
            {!lessons.length && <tr><td colSpan={5} className="muted">Nothing learned yet.</td></tr>}</tbody></table>
      </div>
    </main>
  );
}
