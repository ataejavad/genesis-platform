import { messages, tickets } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Chat, Tone } from "@/ui/bits";

// Messages + support in one inbox (doc 15 §6و).
export default function Inbox() {
  return (
    <main>
      <PageHead title="پیام و پشتیبانی" crumbs="پورتال مشتری" sub="همه گفتگوها با تیم ما و درخواست‌های پشتیبانی در یک جا." actions={<><button className="btn">📅 رزرو جلسه</button><button className="btn primary">＋ درخواست پشتیبانی</button></>} />
      <section className="grid g-2-1">
        <div className="card"><h3>گفتگو: پروژه اتصال CRM</h3><Chat items={messages} /><div className="row" style={{ marginTop: 12 }}><input placeholder="پیام شما… (به زبان خودتان؛ ترجمه خودکار)" style={{ flex: 1 }} /><button className="btn primary">ارسال</button></div></div>
        <div className="card"><h3>درخواست‌های پشتیبانی</h3>
          <div className="list">{tickets.map((t) => <div key={t.no} className="item"><div className="grow"><b className="ltr">{t.no}</b> {t.t}<div className="muted small">{t.sla}</div></div><Tone text={t.status === "تمام" ? "تمام" : "منتظر"} /></div>)}</div>
        </div>
      </section>
    </main>
  );
}
