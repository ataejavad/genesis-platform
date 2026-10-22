import Link from "next/link";
import { fmtEur, partners, projects, tasks } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Progress, StatusBadge } from "@/ui/bits";
import { Board } from "@/ui/Board";

export default function Projects() {
  return (
    <main>
      <PageHead title="پروژه‌ها و کارها" crumbs="کابین › تحویل" sub="پروژه‌های مشتری (وایت‌لیبل) و پروژه‌های داخلی شرکت، در یک جا." actions={<button className="btn primary">+ پروژه تازه</button>} />
      <div className="card table-wrap" style={{ marginBottom: 18 }}>
        <table className="table">
          <thead><tr><th>کد</th><th>پروژه</th><th>نوع</th><th>همکار</th><th>پروتکل</th><th>پیشرفت</th><th>حاشیه</th><th>وضعیت</th></tr></thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id}>
                <td className="ltr">{p.id}</td>
                <td><Link href={`/cockpit/projects/${p.id}`}>{p.title}</Link>{p.customer && <div className="muted small">{p.customer}</div>}</td>
                <td><span className={`badge ${p.kind === "customer" ? "" : "gray"}`}>{p.kind === "customer" ? "مشتری" : "داخلی"}</span></td>
                <td>{p.partner}</td>
                <td className="small">{p.protocol}</td>
                <td style={{ width: 110 }}><Progress value={p.progress} /></td>
                <td className="num">{p.sell ? `${fmtEur(p.sell - (p.cost ?? 0))} (${Math.round(((p.sell - (p.cost ?? 0)) / p.sell) * 100)}٪)` : "—"}</td>
                <td><StatusBadge status={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>همه کارها</h2>
      <Board tasks={tasks} partners={partners} />
    </main>
  );
}
