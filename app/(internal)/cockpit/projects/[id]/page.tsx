import { notFound } from "next/navigation";
import { fmtEur, messages, partnerMessages, projects, tasks } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Chat, Progress, StatusBadge, Steps } from "@/ui/bits";

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = projects.find((x) => x.id === id);
  if (!p) notFound();
  const own = tasks.filter((t) => t.project === p.id);
  return (
    <main>
      <PageHead title={p.title} crumbs={`کابین › پروژه‌ها › ${p.id}`} sub={p.kind === "customer" ? `مشتری: ${p.customer} (${p.customerCode}) · همکار: ${p.partner} (${p.partnerCode})` : `پروژه داخلی · مسئول: ${p.partner}`} actions={<StatusBadge status={p.status} />} />
      <section className="grid g4" style={{ marginBottom: 18 }}>
        <div className="card stat"><div className="label">پیشرفت</div><div className="value">{p.progress}٪</div><Progress value={p.progress} /></div>
        <div className="card stat"><div className="label">مهلت</div><div className="value" style={{ fontSize: 20 }}>{p.due}</div></div>
        <div className="card stat"><div className="label">قیمت فروش / خرید</div><div className="value" style={{ fontSize: 20 }}>{p.sell ? `${fmtEur(p.sell)} / ${fmtEur(p.cost ?? 0)}` : "داخلی"}</div></div>
        <div className="card stat"><div className="label">پروتکل</div><div className="value" style={{ fontSize: 16 }}>{p.protocol}</div></div>
      </section>
      <section className="grid g-2-1">
        <div className="stack">
          <div className="card">
            <h3>کارها</h3>
            <table className="table">
              <thead><tr><th>کار</th><th>مسئول</th><th>مهلت</th><th>وضعیت</th></tr></thead>
              <tbody>{own.map((t) => (<tr key={t.id}><td>{t.forUs ? "↩︎ " : ""}{t.title}</td><td>{t.agent ? <span className="badge ai">🤖 {t.assignee}</span> : t.assignee}</td><td>{t.due}</td><td><StatusBadge status={t.status} /></td></tr>))}</tbody>
            </table>
          </div>
          {p.kind === "customer" && (
            <div className="grid g2">
              <div className="card"><h3>گفتگو با مشتری (زیر برند ما)</h3><Chat items={messages} /></div>
              <div className="card"><h3>گفتگو با همکار (مشتری با کد)</h3><Chat items={partnerMessages} /></div>
            </div>
          )}
        </div>
        <div className="card"><h3>مراحل</h3><Steps steps={p.steps} /></div>
      </section>
    </main>
  );
}
