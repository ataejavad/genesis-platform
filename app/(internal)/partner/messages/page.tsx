import { partnerMessages } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Chat } from "@/ui/bits";

export default function PartnerMessages() {
  return (
    <main>
      <PageHead title="پیام‌ها" crumbs="پورتال همکاران" sub="با مدیر پروژه و (با واسطه) با مشتری. اطلاعات تماس خودکار پنهان می‌شود؛ ترجمه خودکار است." />
      <section className="grid g-2-1">
        <div className="card"><h3>P-302 · اتصال CRM</h3><Chat items={partnerMessages} /><div className="row" style={{ marginTop: 10 }}><input placeholder="پیام… (هر زبانی)" style={{ flex: 1 }} /><button className="btn primary">ارسال</button></div></div>
        <div className="card"><h3>گفتگوها</h3><div className="list"><div className="item"><b className="ltr">P-302</b><div className="grow small">مدیر پروژه · امروز</div><span className="badge">۱</span></div><div className="item"><b className="ltr">P-288</b><div className="grow small muted">بسته شد</div></div></div></div>
      </section>
    </main>
  );
}
