import { courses } from "@/mock/data";
import { PageHead } from "@/ui/Shell";

export default function Learn() {
  return (
    <main>
      <PageHead title="یادگیری" crumbs="پورتال همکاران" sub="آموزش کوتاه ابزارها و پروتکل‌ها. گذراندن بعضی دوره‌ها برای گرفتن نوع خاصی از کار لازم است." />
      <div className="grid g2">{courses.map((c) => <div key={c.t} className="card row"><span style={{ fontSize: 24 }}>{c.done ? "✅" : "▶️"}</span><div style={{ flex: 1 }}><b>{c.t}</b><div className="muted small">{c.min} دقیقه</div></div><button className="btn sm">{c.done ? "مرور" : "شروع"}</button></div>)}</div>
    </main>
  );
}
