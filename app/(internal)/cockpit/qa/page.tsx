import { qaQueue } from "@/mock/data";
import { PageHead } from "@/ui/Shell";

export default function QA() {
  return (
    <main>
      <PageHead title="سنجش تحویل (QA)" crumbs="کابین › تحویل" sub="ایجنت QA هر تحویل را با معیارهای پروتکل می‌سنجد؛ تو تأیید نهایی می‌کنی (برای تحویل به مشتری همیشه)." />
      <div className="stack">
        {qaQueue.map((q) => (
          <div className="card" key={q.project}>
            <div className="card-head"><h3>{q.deliverable}</h3><span className="more badge">{q.forCustomer ? "برای مشتری" : "داخلی"}</span></div>
            <div className="muted small">پروژه {q.project} · همکار {q.partner} · پروتکل {q.protocol}</div>
            <div className="row" style={{ margin: "12px 0" }}>
              <span className={`badge ${q.ai.passed === q.ai.total ? "ok" : "warn"}`}>{q.ai.passed} از {q.ai.total} معیار برقرار</span>
            </div>
            <div className="callout ai small">✦ {q.ai.note}</div>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn ok">قبول{q.forCustomer ? " و تحویل به مشتری" : ""}</button>
              <button className="btn">برگرداندن برای اصلاح</button>
              <button className="btn danger">رد</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
