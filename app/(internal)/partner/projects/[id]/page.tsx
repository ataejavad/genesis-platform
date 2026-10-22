import { notFound } from "next/navigation";
import { partnerMessages, projects, protocols } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Chat, Progress, Steps } from "@/ui/bits";

// Partner view: customer only by code; protocol attached; delivery checked against it.
export default async function PartnerProject({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = projects.find((x) => x.id === id);
  if (!p) notFound();
  const protocol = protocols[0];
  return (
    <main>
      <PageHead title={p.title} crumbs="پورتال همکاران › پروژه" sub={p.kind === "customer" ? `مشتری ${p.customerCode} · صنعت شیشه · آلمان · مهلت ${p.due}` : `پروژه داخلی · مهلت ${p.due}`} />
      <div className="callout warn small" style={{ marginBottom: 16 }}>این پروژه زیر برند Legend Partner انجام می‌شود. تماس مستقیم با مشتری، نام یا لوگوی شما در خروجی‌ها، و تبادل ایمیل یا تلفن مجاز نیست (قرارداد همکاری).</div>
      <section className="grid g-2-1">
        <div className="stack">
          <div className="card">
            <h3>شرح کار</h3>
            <p>تماس‌های ورودی ایجنت تلفن را با HubSpot مشتری یکی کن: هر تماس یک «Contact» و یک «Deal» با منبع «AI phone» بسازد.</p>
            <div className="row"><b>پیشرفت</b><span className="spacer" />{p.progress}٪</div><Progress value={p.progress} />
          </div>
          <div className="card">
            <div className="card-head"><h3>📐 پروتکل: {p.protocol}</h3><span className="more badge">نسخه ثابت این پروژه</span></div>
            <p className="muted small">نمونه معیارها (از پروتکل {protocol.title}):</p>
            <ul>{protocol.criteria?.slice(0, 4).map((c) => <li key={c.t}>{c.t} {c.must && <span className="badge bad">اجباری</span>}</li>)}</ul>
            <label className="row small"><input type="checkbox" style={{ width: "auto" }} defaultChecked /> پروتکل را خواندم و قبول دارم</label>
          </div>
          <div className="card stack">
            <h3>تحویل کار</h3>
            <label className="field">فایل‌ها<input type="file" multiple /></label>
            <label className="field">خودارزیابی با چک‌لیست پروتکل<textarea placeholder="برای هر معیار: انجام شد / توضیح" /></label>
            <button className="btn primary">ارسال برای سنجش (ایجنت QA ← تأیید ما)</button>
          </div>
        </div>
        <div className="stack">
          <div className="card"><h3>مراحل</h3><Steps steps={p.steps} /></div>
          <div className="card"><h3>گفتگو با مدیر پروژه</h3><Chat items={partnerMessages} /><div className="row" style={{ marginTop: 10 }}><input placeholder="پیام…" style={{ flex: 1 }} /><button className="btn primary sm">ارسال</button></div></div>
        </div>
      </section>
    </main>
  );
}
