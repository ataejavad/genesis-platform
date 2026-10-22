import Link from "next/link";
import { fmtEur, partners, tasks } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Stat, StatusBadge } from "@/ui/bits";

export default function PartnerHome() {
  const me = partners.find((p) => p.code === "H-22")!;
  const mine = tasks.filter((t) => t.assignee === "H-22");
  return (
    <main>
      <PageHead title="سلام Marco 👋" crumbs="پورتال همکاران" sub="کارهای امروز، پیشنهادهای تازه و امتیاز شما." />
      <section className="grid g4" style={{ marginBottom: 18 }}>
        <Stat label="امتیاز کیفیت" value={`★ ${me.score}`} delta={`رتبه ۲ از ۴ در «اتصال CRM»`} />
        <Stat label="قبول در بار اول" value={`${me.firstPass}٪`} delta="هدف: ۸۵٪" up={false} />
        <Stat label="تحویل به‌موقع" value={`${me.onTime}٪`} up />
        <Stat label="درآمد این ماه" value={fmtEur(950)} delta="پس از تأیید QA" />
      </section>
      <section className="grid g-2-1">
        <div className="card">
          <div className="card-head"><h3>کارهای من</h3><Link href="/partner/tasks" className="more">تخته کارها</Link></div>
          <table className="table"><thead><tr><th>کار</th><th>پروژه</th><th>مهلت</th><th>وضعیت</th></tr></thead>
            <tbody>{mine.map((t) => (<tr key={t.id}><td>{t.title}</td><td><Link href={`/partner/projects/${t.project}`} className="ltr">{t.project}</Link></td><td>{t.due}</td><td><StatusBadge status={t.status} /></td></tr>))}</tbody></table>
        </div>
        <div className="card stack">
          <h3>پیشنهاد کار تازه</h3>
          <div><b>اتصال فرم سایت به HubSpot</b><div className="muted small">مشتری C-1077 · صنعت نصاب‌ها · بریتانیا</div></div>
          <div className="row small"><span className="badge">پروتکل: اتصال CRM v1</span><span className="badge gray">۵ روز</span><span className="badge ok">€700</span></div>
          <div className="row"><button className="btn ok sm">قبول</button><button className="btn sm">رد</button></div>
          <div className="muted small">قبول تا ۲۴ ساعت؛ بعد به همکار بعدی پیشنهاد می‌شود.</div>
        </div>
      </section>
    </main>
  );
}
