import { agents, fmtEur } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Tone } from "@/ui/bits";

export default function Agents() {
  return (
    <main>
      <PageHead title="ایجنت‌های پیدایش" crumbs="کابین › ماشین" sub="هر ایجنت: کدام مرحله ماشین را انجام می‌دهد، آخرین اجرا، هزینه و خروجی. اجرا از n8n یا کارگر اپ." actions={<button className="btn primary">+ ایجنت تازه</button>} />
      <div className="grid g2">
        {agents.map((a) => (
          <div className="card stack" key={a.id}>
            <div className="card-head"><span style={{ fontSize: 22 }}>🤖</span><h3>{a.name}</h3><span className="more"><Tone text={a.status} /></span></div>
            <div className="row small muted"><span>مرحله {a.stage}</span><span>·</span><span>آخرین اجرا: {a.lastRun}</span><span>·</span><span>{a.runs} اجرا</span><span>·</span><span>{fmtEur(a.cost)} این ماه</span></div>
            <div className="callout small">آخرین خروجی: {a.output}</div>
            <div className="row">
              <button className="btn sm primary">اجرا</button>
              <button className="btn sm">پرامپت (Git)</button>
              <button className="btn sm">{a.n8n ? "ورک‌فلو n8n" : "کارگر اپ"}</button>
              <button className="btn sm">سطح خودمختاری: تأیید همه</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
