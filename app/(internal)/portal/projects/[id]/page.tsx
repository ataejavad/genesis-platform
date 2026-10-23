import { notFound } from "next/navigation";
import { BRAND, messages, projects } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Chat, Progress, StatusBadge, Steps } from "@/ui/bits";

// Customer view: only our brand, never the partner (white-label, doc 15 §6ب).
export default async function PortalProject({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = projects.find((x) => x.id === id && x.kind === "customer");
  if (!p) notFound();
  return (
    <main>
      <PageHead title={p.title} crumbs="پورتال مشتری › پروژه‌ها" sub={`تیم مسئول: تیم فنی ${BRAND} · تحویل: ${p.due}`} actions={<StatusBadge status={p.status} />} />
      <div className="card" style={{ marginBottom: 18 }}><div className="row"><b>پیشرفت</b><span className="spacer" /><span>{p.progress}٪</span></div><Progress value={p.progress} /></div>
      <section className="grid g-2-1">
        <div className="card">
          <h3>گفتگو با تیم ما</h3>
          <Chat items={messages} />
          <div className="row" style={{ marginTop: 12 }}><input placeholder="پیام شما…" style={{ flex: 1 }} /><button className="btn primary">ارسال</button></div>
        </div>
        <div className="stack">
          <div className="card"><h3>مراحل</h3><Steps steps={p.steps} /></div>
          <div className="card"><h3>تحویل‌ها</h3><div className="list"><div className="item">📄<div className="grow">گزارش آزمون نسخه ۲<div className="muted small">بعد از تأیید کیفیت نمایش داده می‌شود</div></div></div></div></div>
        </div>
      </section>
    </main>
  );
}
