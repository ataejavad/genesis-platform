import { customer } from "@/mock/data";
import { PageHead } from "@/ui/Shell";

export default function PortalCompany() {
  return (
    <main>
      <PageHead title="پروفایل و داده شرکت" crumbs="پورتال مشتری" sub="داده‌های شما مال شماست: هر وقت بخواهید کامل خروجی می‌گیرید." actions={<button className="btn">⬇ خروجی کامل داده (JSON + CSV)</button>} />
      <section className="grid g2">
        <div className="card stack">
          <h3>اطلاعات شرکت</h3>
          <label className="field">نام<input defaultValue={customer.name} /></label>
          <label className="field">صنعت<input defaultValue={customer.industry} /></label>
          <label className="field">کشور<input defaultValue={customer.country} /></label>
          <button className="btn primary">ذخیره</button>
        </div>
        <div className="stack">
          <div className="card"><h3>پرسونای شرکت (پله ۵)</h3><p className="muted">مدل زنده شرکت شما که از کارهای ما با شما یاد می‌گیرد و بعداً با ایجنت‌های شرکت‌های دیگر (تأمین‌کننده، مشتری) کار می‌کند.</p><span className="badge gray">هنوز فعال نشده</span></div>
          <div className="card"><h3>کاربران</h3><div className="list"><div className="item"><span className="avatar">T</span><div className="grow">Thomas Becker<div className="muted small">مدیر</div></div></div><div className="item"><span className="avatar">A</span><div className="grow">Anna Becker<div className="muted small">کارمند</div></div></div></div><button className="btn sm">+ دعوت همکار</button></div>
          <div className="card"><h3>حریم خصوصی</h3><p className="muted small">قرارداد پردازش داده (DPA)، فهرست پیمانکاران فرعی (دسته‌بندی‌شده)، درخواست حذف داده.</p></div>
        </div>
      </section>
    </main>
  );
}
