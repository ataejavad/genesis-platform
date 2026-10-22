import { fmtEur, jobOffers } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { ActionButton } from "@/ui/site/SiteClient";

// AI job matching: offers ranked by fit (skills, rank, capacity, language).
export default function Jobs() {
  return (
    <main>
      <PageHead title="صندوق کار" crumbs="پورتال همکاران" sub="پیشنهادها بر اساس تناسب با شما مرتب شده‌اند. هر پیشنهاد ۲۴ ساعت معتبر است." />
      <div className="stack">
        {jobOffers.map((j) => (
          <div key={j.id} className="card row" style={{ alignItems: "flex-start" }}>
            <div style={{ display: "grid", justifyItems: "center", minWidth: 90 }}><div className="ring" style={{ ["--p" as string]: j.fit, width: 72, height: 72 }}><div style={{ width: 54, height: 54, fontSize: 16 }}>{j.fit}٪</div></div><span className="muted small">تناسب</span></div>
            <div style={{ flex: 1 }}>
              <b>{j.title}</b>
              <div className="muted small">مشتری {j.customer} · {j.hub}</div>
              <div className="row small" style={{ margin: "6px 0" }}><span className="badge">📐 {j.protocol}</span><span className="badge gray">⏱ {j.days} روز</span><span className="badge ok">{fmtEur(j.pay)}</span></div>
              <div className="callout ai small">✦ چرا شما: {j.why}</div>
            </div>
            <div className="stack"><ActionButton className="btn ok" label="قبول" done="قبول شد؛ قرارداد پروژه آماده امضاست" /><button className="btn sm">رد</button></div>
          </div>
        ))}
      </div>
    </main>
  );
}
