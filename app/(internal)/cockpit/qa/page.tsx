import { qa } from "@/mock/cockpit";
import { PageHead } from "@/ui/Shell";

export default function QaQueue() {
  return (
    <main>
      <PageHead title="QA queue" crumbs="Cockpit › Delivery" sub="The QA judge scores each criterion; medium risk comes here at final delivery, high risk always. Repeated failures feed protocol updates." />
      <div className="stack">{qa.map((q) => (
        <div key={q.project + q.deliverable} className="card">
          <div className="card-head"><h3>{q.project} · {q.deliverable}</h3><span className={`badge ${q.risk === "medium" ? "warn" : "gray"}`}>{q.risk}</span>{q.forCustomer && <span className="badge">customer-facing</span>}</div>
          <div className="row small"><span>By {q.by}</span><span>· {q.protocol}</span><span>· <b>{q.passed}/{q.total}</b> criteria passed</span></div>
          <div className="callout ai small" style={{ margin: "10px 0" }}>✦ {q.note}</div>
          <div className="row"><button className="btn ok sm">Accept → pay partner → send to customer</button><button className="btn sm">Return with notes</button></div>
        </div>
      ))}</div>
    </main>
  );
}
