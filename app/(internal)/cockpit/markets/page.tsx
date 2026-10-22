import { markets } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Tone } from "@/ui/bits";

export default function Markets() {
  return (
    <main>
      <PageHead title="بازارها (فیلترها)" crumbs="کابین › فروش" sub="خروجی ایجنت انتخاب بازار (مرحله ۰الف پیدایش): هر ترکیب صنعت × کشور با ۵ معیار امتیاز می‌گیرد." actions={<button className="btn primary">✦ اجرای دوباره ایجنت</button>} />
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>فیلتر</th><th>تقاضا</th><th>رقابت (کمتر بهتر)</th><th>دسترسی</th><th>قانون</th><th>حاشیه</th><th>امتیاز کل</th><th>وضعیت</th><th></th></tr></thead>
          <tbody>
            {markets.map((m) => (
              <tr key={m.filter}>
                <td><b>{m.filter}</b></td>
                <td className="num">{m.demand}</td><td className="num">{m.competition}</td><td className="num">{m.access}</td><td className="num">{m.law}</td><td className="num">{m.margin}</td>
                <td className="num"><b>{m.total}</b></td>
                <td><Tone text={m.status} /></td>
                <td>{m.status === "نامزد" ? <button className="btn sm primary">فعال کن</button> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="callout" style={{ marginTop: 16 }}>فعال کردن یک فیلتر یعنی: ایجنت بازار فایل پیکربندی آن را می‌سازد، ایجنت محتوا صفحه‌های صنعت را پیش‌نویس می‌کند و شکارچی سرنخ فهرست شرکت‌ها را شروع می‌کند (همه با تأیید تو).</div>
    </main>
  );
}
