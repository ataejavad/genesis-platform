import { MEDIA, THEME_LABEL } from "@/config/media";
import { getDb } from "@/db";
import { providerStatus } from "@/providers/registry";
import { agentStatus } from "@/server/agents";
import { ctaLink, mediaKpi, mediaList } from "@/server/media";
import { PageHead } from "@/ui/Shell";
import { AgentControls, RunJob } from "../agents/Forms";
import { approve, edit, posted, reject } from "./actions";

export const dynamic = "force-dynamic";

const when = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(d) : "–");
const BADGE: Record<string, string> = { draft: "warn", approved: "ai", handed: "warn", posted: "ok", sent: "ok", rejected: "gray", skipped: "gray", sending: "ai" };
const ICON: Record<string, string> = { linkedin: "💼", youtube: "🎬", newsletter: "📬" };

// Media engine (doc 11): the week's pieces, what waits for Javad, and what the media brings against the 6-month goal.
export default async function Media() {
  const db = getDb();
  const [k, rows, agent] = await Promise.all([mediaKpi(db), mediaList(db), agentStatus(db, "media-writer")]);
  const social = providerStatus("social");
  const email = providerStatus("email");
  const pct = (a: number, b: number) => `${Math.min(100, Math.round((a / b) * 100))}%`;
  return (
    <main>
      <PageHead
        title="Media"
        crumbs="Cockpit › Growth"
        sub={`Newsletter = the list we own; LinkedIn (your profile) and short videos feed it. Monday 07:00 the media writer drafts the week; you approve on the phone or here; pieces go out at their slot (Rome time). Goal by ${MEDIA.goals.by}: ${MEDIA.goals.subscribers} subscribers, ${MEDIA.goals.checkupsPerMonth} check-ups a month from media.`}
        actions={<RunJob id="media.drafts" />}
      />
      <section className="grid g4" style={{ marginBottom: 18 }}>
        <div className="card stat"><div className="label">Newsletter subscribers (confirmed)</div><div className="value">{k.subscribers} <span className="muted small">/ {k.subscribersGoal} · {pct(k.subscribers, k.subscribersGoal)}</span></div><div className="muted small">+{k.newSubscribers30} in 30 days</div></div>
        <div className="card stat"><div className="label">Check-ups from media, this month</div><div className="value">{k.checkupsFromMedia} <span className="muted small">/ {k.checkupsGoal}</span></div></div>
        <div className="card stat"><div className="label">Published this month</div><div className="value">{k.publishedMonth}</div><div className="muted small">{k.lastIssue ? `last issue to ${k.lastIssue.recipients} people` : "no issue sent yet"}</div></div>
        <div className="card stat"><div className="label">Waiting for you</div><div className="value">{k.drafts + k.handed}</div><div className="muted small">{k.drafts} to approve · {k.handed} to post · {k.approved} scheduled</div></div>
      </section>
      <section className="card" style={{ marginBottom: 18 }}>
        <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div className="small">
            <b>Media writer</b> · {agent.allowed ? <span className="badge ok">on</span> : <span className="badge warn">{agent.stopped ? "emergency stop" : !agent.enabled ? "off" : "over budget"}</span>} · €{agent.spentEur} of €{agent.budgetEur} this month ·
            {" "}LinkedIn: <b>{social.label}</b> · Newsletter email: <b>{email.connected ? email.label : "no sender (mails wait in Outbox)"}</b>
          </div>
          <AgentControls id="media-writer" enabled={agent.enabled} paused={agent.paused} budget={agent.budgetEur} />
        </div>
        <p className="muted small" style={{ marginTop: 8 }}>Open and click rates are not measured yet; reach is counted by subscribers and check-ups that arrive through the links in the posts (?from=media-…).</p>
      </section>
      <div className="stack">
        {rows.map((p) => (
          <details key={p.id} id={p.id} className="card" open={p.status === "draft" || p.status === "handed"}>
            <summary className="row" style={{ gap: 8, flexWrap: "wrap", cursor: "pointer" }}>
              <span>{ICON[p.channel]}</span>
              <b>{p.title}</b>
              <span className="muted small">{p.week} · {p.lang} · {THEME_LABEL[p.theme as keyof typeof THEME_LABEL] ?? p.theme}{p.writer === "rules" ? " · rule-based" : ""}</span>
              <span className={`badge ${BADGE[p.status] ?? "gray"}`}>{p.status === "handed" ? "post it now" : p.status}</span>
              <span className="muted small">{p.status === "sent" ? `sent ${when(p.publishedAt)} to ${p.recipients}` : `slot ${when(p.scheduledFor)}`}</span>
            </summary>
            <div className="grid g2" style={{ marginTop: 10 }}>
              <div className="stack" style={{ gap: 6 }}>
                {["draft", "approved"].includes(p.status) ? (
                  <form action={edit} className="stack" style={{ gap: 6 }}>
                    <input type="hidden" name="id" value={p.id} />
                    <input name="title" defaultValue={p.title} aria-label="Title" />
                    <textarea name="body" defaultValue={p.body} rows={12} aria-label="Text" />
                    <button className="btn sm">Save text{p.status === "approved" ? " (needs approval again)" : ""}</button>
                  </form>
                ) : (
                  <pre className="small" style={{ whiteSpace: "pre-wrap" }}>{p.body}</pre>
                )}
                <div className="muted small">Link at the end: <a className="ltr" href={ctaLink(p)}>{p.cta === "checkup" ? "free check-up" : "newsletter sign-up"}</a>{p.sourceUrl && <> · Source: <a href={p.sourceUrl} target="_blank" rel="noreferrer">{p.sourceTitle ?? p.sourceUrl}</a></>}</div>
              </div>
              <div className="stack" style={{ gap: 6 }}>
                {p.bodyFa && <div dir="rtl" className="small" style={{ whiteSpace: "pre-wrap" }}>{p.bodyFa}</div>}
                {p.status === "draft" && (
                  <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                    <form action={approve}><input type="hidden" name="id" value={p.id} /><button className="btn sm ok">✅ Approve</button></form>
                    <form action={reject} className="row" style={{ gap: 4 }}><input type="hidden" name="id" value={p.id} /><input name="note" placeholder="Why? (the writer learns)" /><button className="btn sm">❌ Reject</button></form>
                  </div>
                )}
                {p.status === "handed" && (
                  <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                    {p.publishedRef?.startsWith("https://") && <a className="btn sm primary" href={`/api/media/${p.id}/share`} target="_blank" rel="noreferrer">📲 Open LinkedIn with the post</a>}
                    <form action={posted}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="op" value="posted" /><button className="btn sm ok">✅ Posted</button></form>
                    <form action={posted}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="op" value="skip" /><button className="btn sm">⏭ Skip</button></form>
                  </div>
                )}
                {p.note && <div className="muted small">Note: {p.note}</div>}
              </div>
            </div>
          </details>
        ))}
        {!rows.length && <div className="card muted">Nothing yet. The media writer runs on Monday 07:00, or press “Run now”.</div>}
      </div>
    </main>
  );
}
