import Link from "next/link";
import { fmtEur, jobOffers, partners, tasks, vault } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Stat, StatusBadge } from "@/ui/bits";

// Home shows "the next thing to do"; rank is the motivation (doc 15 §6ب).
export default function PartnerHome() {
  const me = partners.find((p) => p.code === "H-22")!;
  const mine = tasks.filter((t) => t.assignee === "H-22");
  const expiring = vault.filter((v) => v.status === "منقضی می‌شود");
  return (
    <main>
      <PageHead title="سلام Marco 👋" crumbs="پورتال همکاران" sub="کار بعدی شما، پیشنهادهای تازه و رتبه‌تان." />
      <div className="callout ai" style={{ marginBottom: 16 }}>✦ <b>کار بعدی:</b> «نقشه فیلدها بین تلفن و CRM» (P-302) تا ۰۸/۰۸. پیش از ارسال، خودسنجی AI را اجرا کنید؛ ۲ معیار هنوز پوشش داده نشده است. <Link href="/partner/projects/P-302">باز کردن ←</Link></div>
      <section className="grid g4" style={{ marginBottom: 18 }}>
        <Stat label="سطح" value="حرفه‌ای" delta="۳ پروژه تا «برتر»" />
        <Stat label="امتیاز کیفیت" value={`★ ${me.score}`} delta="رتبه ۲ در «اتصال CRM»" />
        <Stat label="قبول در بار اول" value={`${me.firstPass}٪`} delta="هدف: ۸۵٪" up={false} />
        <Stat label="درآمد این ماه" value={fmtEur(950)} delta="پرداخت ۲۴ ساعت پس از قبولی QA" />
      </section>
      <section className="grid g-2-1">
        <div className="card">
          <div className="card-head"><h3>کارهای امروز</h3><Link href="/partner/tasks" className="more">تخته کارها</Link></div>
          <table className="table"><thead><tr><th>کار</th><th>پروژه</th><th>مهلت</th><th>وضعیت</th></tr></thead>
            <tbody>{mine.map((t) => (<tr key={t.id}><td>{t.title}</td><td><Link href={`/partner/projects/${t.project}`} className="ltr">{t.project}</Link></td><td>{t.due}</td><td><StatusBadge status={t.status} /></td></tr>))}</tbody></table>
        </div>
        <div className="stack">
          <div className="card"><div className="card-head"><h3>📥 بهترین پیشنهاد برای شما</h3><Link href="/partner/jobs" className="more">همه ({jobOffers.length})</Link></div>
            <b>{jobOffers[0].title}</b><div className="muted small">{jobOffers[0].hub} · {jobOffers[0].days} روز · {fmtEur(jobOffers[0].pay)}</div>
            <div className="row" style={{ marginTop: 8 }}><span className="badge ai">✦ تناسب {jobOffers[0].fit}٪</span></div>
          </div>
          {expiring.map((v) => <div key={v.t} className="callout warn small">⚠️ {v.t} تا {v.exp} منقضی می‌شود. <Link href="/partner/profile">آپلود نسخه تازه</Link></div>)}
        </div>
      </section>
    </main>
  );
}
