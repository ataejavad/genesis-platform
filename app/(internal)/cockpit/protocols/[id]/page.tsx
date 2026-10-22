import { notFound } from "next/navigation";
import { protocols } from "@/mock/data";
import { PageHead } from "@/ui/Shell";

export default async function ProtocolDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = protocols.find((x) => x.id === id);
  if (!p) notFound();
  return (
    <main>
      <PageHead title={`${p.title} (${p.version})`} crumbs={`کابین › پروتکل‌ها › ${p.id}`} sub={p.category} actions={<><button className="btn">تاریخچه نسخه‌ها</button><button className="btn primary">✦ پیشنهاد بهبود از روی خطاها</button></>} />
      {"criteria" in p && p.criteria ? (
        <section className="grid g-2-1">
          <div className="card">
            <h3>معیارهای پذیرش</h3>
            <table className="table">
              <thead><tr><th>معیار</th><th>نوع</th><th>وزن</th><th>روش سنجش</th></tr></thead>
              <tbody>{p.criteria.map((c) => (<tr key={c.t}><td>{c.t}</td><td><span className={`badge ${c.must ? "bad" : "gray"}`}>{c.must ? "اجباری" : "مطلوب"}</span></td><td className="num">{c.weight}</td><td>{c.method === "خودکار" ? <span className="badge ok">{c.method}</span> : c.method === "ایجنت QA" ? <span className="badge ai">{c.method}</span> : <span className="badge">{c.method}</span>}</td></tr>))}</tbody>
            </table>
          </div>
          <div className="stack">
            <div className="card"><h3>هدف قابل اندازه‌گیری</h3><p>{p.goal}</p></div>
            <div className="card"><h3>ورودی‌های لازم</h3><ul>{p.inputs?.map((i) => <li key={i}>{i}</li>)}</ul></div>
            <div className="callout small">برای همکار فریلنسر، پروتکل فقط «چه چیزی و با چه کیفیتی» را تعیین می‌کند، نه «چطور، کی و کجا».</div>
          </div>
        </section>
      ) : (
        <div className="card empty">جزئیات این پروتکل در نسخه نمایشی پر نشده است. نمونه کامل: «راه‌اندازی ایجنت قیمت‌دهی».</div>
      )}
    </main>
  );
}
