import Link from "next/link";
import { customer, fmtEur, projects, services } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Progress, Ring, Stat, StatusBadge } from "@/ui/bits";

export default function PortalHome() {
  const mine = projects.filter((p) => p.customerCode === customer.id);
  return (
    <main>
      <PageHead title={`سلام ${customer.contact} 👋`} crumbs={customer.name} sub="خلاصه نتیجه‌هایی که این ماه گرفتید." actions={<Link href="/portal/advisor" className="btn primary">✦ از مشاور AI بپرسید</Link>} />
      <section className="grid g4" style={{ marginBottom: 18 }}>
        <Stat label="ساعت صرفه‌جویی این ماه" value={customer.savedHours} delta="▲ ۴۸٪" up />
        <Stat label="کار برنده‌شده با کمک AI" value={customer.wonJobs} delta="▲ ۳ نسبت به ماه قبل" up />
        <Stat label="خدمات فعال" value={services.length} />
        <Stat label="هزینه ماهانه" value={fmtEur(customer.monthlyFee)} />
      </section>
      <section className="grid g-2-1" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card-head"><h3>پروژه‌های در جریان</h3><Link className="more" href="/portal/projects">همه</Link></div>
          <div className="list">
            {mine.map((p) => (
              <Link href={`/portal/projects/${p.id}`} className="item" key={p.id} style={{ color: "inherit", textDecoration: "none" }}>
                <div className="grow"><b>{p.title}</b><div style={{ marginTop: 6 }}><Progress value={p.progress} /></div></div>
                <StatusBadge status={p.status} />
              </Link>
            ))}
          </div>
        </div>
        <div className="card" style={{ display: "grid", justifyItems: "center", gap: 10 }}>
          <h3>امتیاز آمادگی AI</h3>
          <Ring value={customer.readiness} label="از ۱۰۰" />
          <div className="muted small">از {customer.readinessHistory[0]} در اولین چک‌آپ</div>
          <Link href="/portal/services" className="btn sm">پله بعدی پیشنهادی</Link>
        </div>
      </section>
      <section className="grid g2">
        <div className="card">
          <h3>خدمات فعال</h3>
          <div className="list">{services.map((s) => (<div className="item" key={s.id}><span className="badge">پله {s.step}</span><div className="grow"><b>{s.name}</b><div className="muted small">{s.kpi}</div></div></div>))}</div>
        </div>
        <div className="callout ai">
          <b>✦ پیشنهاد مشاور AI شما</b>
          <p style={{ marginTop: 8 }}>۳۸٪ تماس‌های شما بیرون از ساعت کاری است و ۱۱ مورد آن درخواست اندازه‌گیری بوده. با «رزرو خودکار بازدید» (پله ۳) این‌ها مستقیم به تقویم تیم نصب می‌روند. برآورد: ۶ کار بیشتر در ماه.</p>
          <Link href="/portal/services" className="btn sm primary">جزئیات و قیمت</Link>
        </div>
      </section>
    </main>
  );
}
