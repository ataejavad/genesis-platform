import Link from "next/link";
import { getDb } from "@/db";
import { qaQueue } from "@/server/projects";
import { PageHead } from "@/ui/Shell";
import { QaForm } from "../projects/Forms";

// Step 7: deliveries waiting for a person. The judge (with the Claude key) scores each criterion first;
// low-risk work from trusted partners can pass alone except a 15% sample. Your checks calibrate the judge.
export default async function QaQueue() {
  const queue = await qaQueue(getDb());
  return (
    <main className="stack">
      <PageHead title="QA queue" crumbs="Cockpit › Delivery" sub="Check each criterion. Any mandatory fail sends the work back with your note; accepting pays the partner and moves the milestone to the customer." />
      {queue.length === 0 && <div className="card"><p className="muted">Nothing waiting.</p></div>}
      {queue.map((q) => (
        <div key={q.delivery.id} className="card stack">
          <div className="card-head" style={{ flexWrap: "wrap" }}>
            <h3>{q.job.title}</h3>
            {q.project ? <Link className="badge" href={`/cockpit/projects/${q.project.id}`}>{q.project.code}</Link> : <span className="badge gray">no project</span>}
            {q.project && <span className={`badge ${q.project.risk === "high" ? "bad" : q.project.risk === "medium" ? "warn" : "gray"}`}>{q.project.risk}</span>}
            {q.code && <span className="badge gray">{q.code} v{q.version?.version}</span>}
          </div>
          <div className="small">{q.partner} · v{q.delivery.version} · <a href={q.delivery.link} target="_blank" rel="noopener noreferrer">{q.delivery.link}</a> · {q.delivery.createdAt <= q.job.dueAt ? "on time" : "late"}{q.delivery.note && <> · “{q.delivery.note}”</>}</div>
          {q.judge ? <div className="callout ai small">✦ Judge: <b>{q.judge.verdict}</b></div> : <div className="muted small">No judge yet (starts with the Claude key): you decide.</div>}
          <QaForm delivery={q.delivery.id} criteria={q.version?.criteria ?? q.job.checklist.map((text) => ({ text, mandatory: true, method: "human" }))} judge={q.judge?.results ?? null} />
        </div>
      ))}
    </main>
  );
}
