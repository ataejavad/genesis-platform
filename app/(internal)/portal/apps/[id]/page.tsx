import Link from "next/link";
import { notFound } from "next/navigation";
import { appModeLabel, myApps } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Stat } from "@/ui/bits";
import { ActionButton } from "@/ui/site/SiteClient";

const recentQuotes = [
  { no: "Q-1184", to: "Familie Schneider", total: "€2,340", status: "فرستاده‌شده", min: 9 },
  { no: "Q-1183", to: "Bäckerei Wolf", total: "€780", status: "قبول شد", min: 11 },
  { no: "Q-1182", to: "Hausverwaltung Kraus", total: "€14,900", status: "منتظر تأیید شما (بالای سقف)", min: 14 },
];

export default async function AppView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const app = myApps.find((a) => a.id === id);
  if (!app) notFound();
  return (
    <main>
      <PageHead title={`${app.icon} ${app.name}`} crumbs="پورتال مشتری › اپ‌های من" sub={appModeLabel[app.mode]} actions={<><ActionButton className="btn" label="درخواست تغییر" done="ثبت شد" /><Link className="btn" href="/portal/apps">بازگشت</Link></>} />
      {app.mode === "native" && (
        <>
          <section className="grid g4" style={{ marginBottom: 18 }}>
            <Stat label="قیمت این ماه" value="84" delta="▲ ۲۱٪" up />
            <Stat label="میانگین زمان" value="12 min" delta="قبلاً ۲ روز" />
            <Stat label="نرخ قبول" value="38%" delta="▲ ۶ واحد" up />
            <Stat label="منتظر شما" value="1" />
          </section>
          <div className="grid g-2-1">
            <div className="card"><h3>آخرین قیمت‌ها</h3>
              <table className="table"><thead><tr><th>شماره</th><th>مشتری</th><th>مبلغ</th><th>زمان</th><th>وضعیت</th></tr></thead>
                <tbody>{recentQuotes.map((q) => <tr key={q.no}><td className="ltr">{q.no}</td><td>{q.to}</td><td className="num">{q.total}</td><td className="num">{q.min} min</td><td>{q.status.includes("منتظر") ? <ActionButton className="btn sm ok" label="تأیید و ارسال" done="فرستاده شد" /> : <span className="badge gray">{q.status}</span>}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="card stack"><h3>تنظیمات ساده</h3>
              <label className="field">سقف قیمت بدون تأیید شما (یورو)<input defaultValue="5000" className="ltr" /></label>
              <label className="field">زبان پیش‌فاکتور<select><option>Deutsch</option><option>English</option><option>Italiano</option></select></label>
              <label className="field">لیست قیمت<input type="file" /></label>
              <button className="btn primary">ذخیره</button>
            </div>
          </div>
        </>
      )}
      {app.mode === "embedded" && (
        <div className="card" style={{ minHeight: 360, display: "grid", placeItems: "center", background: "repeating-linear-gradient(45deg, var(--bg), var(--bg) 12px, var(--panel) 12px, var(--panel) 24px)" }}>
          <div className="card" style={{ textAlign: "center" }}><b>قاب ابزار شریک، با برند ما</b><p className="muted small">داشبورد تماس‌ها، ضبط مکالمه و تنظیم پیام‌ها اینجا جاسازی می‌شود (iframe با ورود خودکار).</p></div>
        </div>
      )}
      {app.mode === "sso" && (
        <div className="card stack" style={{ maxWidth: 560 }}>
          <p>این ابزار اجازه جاسازی نمی‌دهد. با یک کلیک و بدون رمز جداگانه واردش می‌شوید؛ حساب و صورتحساب پیش ماست.</p>
          <span className="badge warn" style={{ justifySelf: "start" }}>در حال راه‌اندازی · ۲ روز</span>
          <button className="btn primary" disabled style={{ opacity: 0.6 }}>↗ باز کردن (ورود یک‌کلیکی)</button>
        </div>
      )}
    </main>
  );
}
