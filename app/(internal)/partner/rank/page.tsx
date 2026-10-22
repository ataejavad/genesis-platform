import { partners, tiers } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Progress } from "@/ui/bits";

export default function Rank() {
  const me = partners.find((p) => p.code === "H-22")!;
  return (
    <main>
      <PageHead title="رتبه و سطح" crumbs="پورتال همکاران" sub="رتبه کاملاً شفاف است: از نتیجه سنجش‌های QA و بازخورد مشتری‌ها محاسبه می‌شود." />
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row">{tiers.map((t, i) => <div key={t.name} style={{ flex: 1, textAlign: "center" }}><div className={`badge ${i === 2 ? "ok" : i < 2 ? "" : "gray"}`}>{t.name}</div><div className="muted small">{t.min}+ پروژه</div></div>)}</div>
        <div style={{ marginTop: 10 }}><Progress value={62} /></div>
        <p className="small" style={{ marginTop: 10 }}>سطح فعلی: <b>حرفه‌ای</b>. برای «برتر»: ۳ پروژه دیگر با قبول در بار اول بالای ۸۵٪.</p>
      </div>
      <section className="grid g2">
        <div className="card"><h3>چرا این امتیاز؟</h3>
          {[["قبول در بار اول", me.firstPass, "۴۰٪ وزن"], ["تحویل به‌موقع", me.onTime, "۳۰٪ وزن"], ["رضایت مشتری", 92, "۲۰٪ وزن"], ["پاسخ‌گویی", 88, "۱۰٪ وزن"]].map(([l, v, w]) => (
            <div key={String(l)} style={{ marginBottom: 10 }}><div className="row small"><span>{l}</span><span className="muted">{w}</span><span className="spacer" /><b>{v}٪</b></div><Progress value={Number(v)} /></div>
          ))}
        </div>
        <div className="card"><h3>✦ پیشنهاد AI برای بهتر شدن</h3><ul className="small"><li>در ۲ تحویل آخر معیار «راهنمای کوتاه برای کارمند مشتری» ناقص بود.</li><li>خودسنجی AI را قبل از هر ارسال اجرا کنید؛ همکاران برتر همیشه این کار را می‌کنند.</li></ul><h3>نشان‌ها</h3><div className="row"><span className="badge ok">🏅 HubSpot</span><span className="badge ok">⚡ تحویل سریع</span><span className="badge gray">🌍 ۳ زبان</span></div></div>
      </section>
    </main>
  );
}
