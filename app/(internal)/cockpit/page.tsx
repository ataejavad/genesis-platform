import Link from "next/link";
import { agents, fmtEur, leads, projects, qaQueue } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Progress, Stat, StatusBadge, Tone } from "@/ui/bits";

export default function CockpitHome() {
  const funnel = [
    { label: "سرنخ", n: 120 },
    { label: "پیام فرستاده‌شده", n: 48 },
    { label: "چک‌آپ رایگان", n: 11 },
    { label: "جلسه", n: 5 },
    { label: "مشتری", n: 1 },
  ];
  return (
    <main>
      <PageHead title="نمای کلی شرکت" crumbs="کابین" sub="امروز، ۳۰ مهر ۱۴۰۵" actions={<Link className="btn primary" href="/cockpit/approvals">صف تأیید</Link>} />

      <div className="callout ai" style={{ marginBottom: 18 }}>
        <b>✦ خلاصه روزانه ایجنت گزارش:</b> ۱۲۰ شرکت تازه در فهرست شیشه آلمان؛ ۲۰ پیام شخصی منتظر تأیید توست. تحویل پروژه P-301 در QA یک معیار ناقص دارد. همکار H-22 یک بار سعی کرد شماره تلفن رد و بدل کند (نگه داشته شد). هزینه ایجنت‌ها دیروز: €2.4.
      </div>

      <section className="grid g4" style={{ marginBottom: 18 }}>
        <Stat label="درآمد ماهانه تکراری (MRR)" value={fmtEur(1190)} delta="▲ ۷۵٪ نسبت به ماه قبل" up />
        <Stat label="مشتری فعال" value="1" delta="هدف این فصل: ۱۰" />
        <Stat label="حاشیه سود پروژه‌ها" value="۴۵٪" delta="کف تعیین‌شده: ۳۵٪" up />
        <Stat label="هزینه ایجنت‌ها (این ماه)" value={fmtEur(19)} delta="زیر ۲٪ درآمد" up />
      </section>

      <section className="grid g-2-1" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card-head"><h3>قیف فروش (شیشه × آلمان)</h3><Link className="more" href="/cockpit/leads">همه سرنخ‌ها</Link></div>
          <div className="stack">
            {funnel.map((f) => (
              <div key={f.label} className="row">
                <span style={{ width: 130 }}>{f.label}</span>
                <div style={{ flex: 1 }}><Progress value={(f.n / funnel[0].n) * 100} /></div>
                <b className="num" style={{ width: 40, textAlign: "left" }}>{f.n}</b>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-head"><h3>منتظر تو</h3></div>
          <div className="list">
            <div className="item"><span>✉️</span><div className="grow">۲۰ پیام شخصی برای شرکت‌های شیشه</div><Link href="/cockpit/approvals" className="btn sm">بررسی</Link></div>
            <div className="item"><span>🔍</span><div className="grow">{qaQueue.length} تحویل در QA</div><Link href="/cockpit/qa" className="btn sm">بررسی</Link></div>
            <div className="item"><span>🤝</span><div className="grow">۳ درخواست همکاری</div><Link href="/cockpit/partners" className="btn sm">بررسی</Link></div>
            <div className="item"><span>🛡️</span><div className="grow">۱ پیام نگه‌داشته‌شده</div><Link href="/cockpit/moderation" className="btn sm">بررسی</Link></div>
          </div>
        </div>
      </section>

      <section className="grid g2">
        <div className="card">
          <div className="card-head"><h3>پروژه‌ها</h3><Link className="more" href="/cockpit/projects">همه</Link></div>
          <table className="table">
            <thead><tr><th>پروژه</th><th>نوع</th><th>پیشرفت</th><th>وضعیت</th></tr></thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/cockpit/projects/${p.id}`}>{p.title}</Link></td>
                  <td><span className={`badge ${p.kind === "customer" ? "" : "gray"}`}>{p.kind === "customer" ? "مشتری" : "داخلی"}</span></td>
                  <td style={{ width: 120 }}><Progress value={p.progress} /></td>
                  <td><StatusBadge status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          <div className="card-head"><h3>ایجنت‌ها امروز</h3><Link className="more" href="/cockpit/agents">همه</Link></div>
          <div className="list">
            {agents.slice(0, 5).map((a) => (
              <div className="item" key={a.id}>
                <span>🤖</span>
                <div className="grow"><b>{a.name}</b><div className="muted small">{a.output}</div></div>
                <Tone text={a.status} />
              </div>
            ))}
          </div>
        </div>
      </section>
      <p className="muted small" style={{ marginTop: 14 }}>سرنخ‌ها در این قیف: {leads.length} نمونه.</p>
    </main>
  );
}
