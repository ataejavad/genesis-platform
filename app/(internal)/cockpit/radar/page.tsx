import { DECISION_LABEL, RADAR, type RadarDecision } from "@/config/radar";
import { getDb } from "@/db";
import { providerStatus } from "@/providers/registry";
import { agentStatus } from "@/server/agents";
import { radarKpi, radarList } from "@/server/radar";
import { PageHead } from "@/ui/Shell";
import { AgentControls, RunJob } from "../agents/Forms";
import { decide } from "./actions";

export const dynamic = "force-dynamic";

const BADGE: Record<string, string> = { proposed: "warn", shortlisted: "ok", dismissed: "gray", ignored: "gray", unreviewed: "gray", new: "ai" };

// Solutions radar (Javad 2026-11-24): what is new in the world, what problem it solves for whom, and our move.
export default async function Radar() {
  const db = getDb();
  const [k, open, kept, recent, agent] = await Promise.all([radarKpi(db), radarList(db, ["proposed"]), radarList(db, ["shortlisted"], 50), radarList(db, ["ignored", "unreviewed", "dismissed"], 60), agentStatus(db, "solutions-radar")]);
  const feed = providerStatus("news_feed");
  const ai = providerStatus("llm");
  const candidates = kept.filter((r) => r.decision === "resell" || r.decision === "build");
  const Item = ({ r }: { r: (typeof open)[number] }) => {
    const d = DECISION_LABEL[(r.decision ?? "ignore") as RadarDecision];
    return (
      <details id={r.id} className="card" open={r.status === "proposed"}>
        <summary className="row" style={{ gap: 8, flexWrap: "wrap", cursor: "pointer" }}>
          <span>{d.icon}</span>
          <b>{r.maker ?? r.title}</b>
          {r.decision && <span className="muted small">{d.en}{r.fit ? ` · fit ${r.fit}/5` : ""}{r.effort ? ` · effort ${r.effort}` : ""}</span>}
          <span className={`badge ${BADGE[r.status] ?? "gray"}`}>{r.status}</span>
          <span className="muted small">{r.day} · {r.source}</span>
        </summary>
        <div className="grid g2" style={{ marginTop: 10 }}>
          <div className="stack small" style={{ gap: 6 }}>
            <div><a href={r.url} target="_blank" rel="noreferrer">{r.title}</a></div>
            {r.problem && <div><b>Problem:</b> {r.problem}</div>}
            {r.useCase && <div><b>Use:</b> {r.useCase}</div>}
            {r.industries.length > 0 && <div><b>Industries:</b> {r.industries.map((i) => `${i.name} (${i.nace})`).join(", ")}</div>}
            {r.processes.length > 0 && <div><b>Processes (APQC):</b> {r.processes.join(", ")}</div>}
            {r.why && <div><b>Why:</b> {r.why}</div>}
            {r.takeaway.en && <div><b>Our take (hubs, newsletter):</b> {r.takeaway.en}</div>}
            {!r.problem && r.summary && <div className="muted">{r.summary}</div>}
            {r.note && <div className="muted">Note: {r.note}</div>}
            {r.mediaPostId && <div><a href={`/cockpit/media#${r.mediaPostId}`}>💼 LinkedIn post in Media</a></div>}
          </div>
          <div className="stack" style={{ gap: 6 }}>
            {r.summaryFa && <div dir="rtl" className="small" style={{ whiteSpace: "pre-wrap" }}>{r.summaryFa}</div>}
            {r.linkedin && <pre className="small" style={{ whiteSpace: "pre-wrap" }}>{r.linkedin}</pre>}
            {["proposed", "ignored", "unreviewed"].includes(r.status) && (
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {r.linkedin && <form action={decide}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value="keep_post" /><button className="btn sm ok">✅ Keep + LinkedIn post</button></form>}
                <form action={decide}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value="keep" /><button className="btn sm">📌 Keep, no post</button></form>
                {r.status === "proposed" && <form action={decide} className="row" style={{ gap: 4 }}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value="dismiss" /><input name="note" placeholder="Why? (the radar learns)" /><button className="btn sm">❌ Dismiss</button></form>}
              </div>
            )}
          </div>
        </div>
      </details>
    );
  };
  return (
    <main>
      <PageHead
        title="Solutions radar"
        crumbs="Cockpit › Growth"
        sub={`Every day at ${RADAR.at} (Rome) the radar reads new products and technology news, and proposes up to ${RADAR.maxPicks} that solve a real problem for our industries: resell, build our own, or ignore. You keep or dismiss on the phone or here. A kept solution becomes a LinkedIn post, news with our take on the matching hubs, a marketplace candidate and a newsletter seed.`}
        actions={<RunJob id="radar.daily" />}
      />
      <section className="grid g4" style={{ marginBottom: 18 }}>
        <div className="card stat"><div className="label">Waiting for you</div><div className="value">{k.waiting}</div></div>
        <div className="card stat"><div className="label">Kept this month</div><div className="value">{k.keptMonth}</div><div className="muted small">{k.readMonth} items read</div></div>
        <div className="card stat"><div className="label">Marketplace candidates</div><div className="value">{k.candidates}</div><div className="muted small">kept, resell or build</div></div>
        <div className="card stat"><div className="label">Last run</div><div className="value small">{k.lastDay ?? "never"}</div></div>
      </section>
      <section className="card" style={{ marginBottom: 18 }}>
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div className="small">
            <b>Solutions radar</b> · {agent.allowed ? <span className="badge ok">on</span> : <span className="badge warn">{agent.stopped ? "emergency stop" : !agent.enabled ? "off" : "over budget"}</span>} · €{agent.spentEur} of €{agent.budgetEur} this month · Feeds: <b>{feed.label}</b> · AI: <b>{ai.connected ? ai.label : "not connected (items listed unanalysed)"}</b>
          </div>
          <AgentControls id="solutions-radar" enabled={agent.enabled} paused={agent.paused} budget={agent.budgetEur} />
        </div>
      </section>
      <h3>To decide</h3>
      <div className="stack" style={{ marginBottom: 18 }}>
        {open.map((r) => <Item key={r.id} r={r} />)}
        {!open.length && <div className="card muted">Nothing waiting. The radar runs daily at {RADAR.at}, or press “Run now”.</div>}
      </div>
      <h3 id="candidates">Marketplace candidates ({candidates.length})</h3>
      <p className="muted small">Kept solutions we could sell: resell through a partner / white-label, or build our own with partners. Turning one into a package (tasks, milestones, price) is done in Catalog.</p>
      <div className="stack" style={{ marginBottom: 18 }}>
        {candidates.map((r) => <Item key={r.id} r={r} />)}
      </div>
      <h3>Read recently (not proposed)</h3>
      <div className="card small">
        {recent.map((r) => (
          <div key={r.id} className="row" style={{ gap: 6, flexWrap: "wrap" }}>
            <span className={`badge ${BADGE[r.status] ?? "gray"}`}>{r.status}</span>
            <a href={r.url} target="_blank" rel="noreferrer">{r.title}</a>
            <span className="muted">{r.source} · {r.day}</span>
          </div>
        ))}
        {!recent.length && <span className="muted">Nothing yet.</span>}
      </div>
    </main>
  );
}
