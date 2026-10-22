import { count, eq, isNull, and, gte } from "drizzle-orm";
import ReactMarkdown from "react-markdown";
import { getDb } from "@/db";
import { contentItems, events } from "@/db/schema";
import { listPendingApprovals } from "@/server/content";
import { MAX_ATTEMPTS } from "@/worker/dispatch";
import { PageHead } from "@/ui/Shell";
import { decide } from "../actions";
import { approvals } from "@/mock/cockpit";

export const dynamic = "force-dynamic";

export default async function Approvals() {
  const db = getDb();
  const [pending, [published], [stuck]] = await Promise.all([
    listPendingApprovals(db),
    db.select({ n: count() }).from(contentItems).where(eq(contentItems.status, "published")),
    db.select({ n: count() }).from(events).where(and(isNull(events.dispatchedAt), gte(events.attempts, MAX_ATTEMPTS))),
  ]);

  return (
    <main>
      <PageHead title="Approvals" crumbs="Cockpit" sub="Risk-tiered: low risk is automatic with sampling, medium goes to the QA judge, high and the hard limits come here (or Telegram)." />
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><h3>Agent & partner proposals</h3><span className="badge gray">sample data</span></div>
        <table className="table"><thead><tr><th>Type</th><th>What</th><th>From</th><th>Risk</th><th>Why it is here</th><th /></tr></thead>
          <tbody>{approvals.map((a) => <tr key={a.t}><td>{a.kind}</td><td><b>{a.t}</b></td><td>{a.by}</td><td><span className={`badge ${a.risk === "high" ? "bad" : a.risk === "medium" ? "warn" : "gray"}`}>{a.risk}</span></td><td className="muted small">{a.why}</td><td><div className="row"><button className="btn sm ok">Approve</button><button className="btn sm danger">Reject</button></div></td></tr>)}</tbody></table>
      </div>
      <h2>Website content <span className="badge ok">live database</span></h2>
      <section className="grid g3" style={{ marginBottom: 20 }}>
        <div className="card stat"><div className="label">Waiting</div><div className="value">{pending.length}</div></div>
        <div className="card stat"><div className="label">Published pages</div><div className="value">{published.n}</div></div>
        <div className="card stat"><div className="label">Stuck events</div><div className="value" style={{ color: stuck.n ? "var(--bad)" : undefined }}>{stuck.n}</div></div>
      </section>
      {pending.length === 0 && <div className="card empty">Nothing is waiting for approval.</div>}
      {pending.map((a) => (
        <article key={a.id} className="card" style={{ marginBottom: 14 }}>
          <div className="card-head">
            <h3>{a.title}</h3>
            <span className="badge">{a.liveStatus === "published" ? "Edit of live page" : "New page"}</span>
          </div>
          <p className="muted small ltr" style={{ textAlign: "left" }}>
            /{a.locale}/{a.slug} · v{a.subjectVersion} · {a.requestedBy} · {a.createdAt.toISOString().slice(0, 16).replace("T", " ")}
          </p>
          <div dir="auto" style={{ maxHeight: 300, overflow: "auto", borderTop: "1px solid var(--line)", paddingTop: 8 }}>
            <ReactMarkdown>{a.body}</ReactMarkdown>
          </div>
          <form action={decide} className="row" style={{ marginTop: 12 }}>
            <input type="hidden" name="id" value={a.id} />
            <input name="note" placeholder="Note (optional)" style={{ flex: 1, minWidth: 180 }} />
            <button className="btn ok" name="decision" value="approved">Approve & publish</button>
            <button className="btn danger" name="decision" value="rejected">Reject</button>
          </form>
        </article>
      ))}
    </main>
  );
}
