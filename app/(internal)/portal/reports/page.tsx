import { reports } from "@/mock/data";
import { PageHead } from "@/ui/Shell";

export default function PortalReports() {
  return (
    <main>
      <PageHead title="گزارش‌های ماهانه" crumbs="پورتال مشتری" sub="هر ماه ایجنت گزارش، نتیجه خدمات را به عدد می‌گوید." />
      <div className="stack">
        {reports.map((r) => (
          <div className="card" key={r.month}>
            <div className="card-head"><h3>{r.month}</h3><button className="more btn sm">دانلود PDF</button></div>
            <div className="grid g3" style={{ marginBottom: 10 }}>
              <div><div className="muted small">ساعت صرفه‌جویی</div><b style={{ fontSize: 22 }}>{r.hours}</b></div>
              <div><div className="muted small">کار برنده‌شده</div><b style={{ fontSize: 22 }}>{r.jobs}</b></div>
              <div><div className="muted small">تماس پاسخ‌داده‌شده</div><b style={{ fontSize: 22 }}>{r.calls}</b></div>
            </div>
            <div className="callout ai small">✦ {r.highlight}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
