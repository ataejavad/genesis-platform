import Link from "next/link";
import { protocols } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Progress } from "@/ui/bits";

export default function Protocols() {
  return (
    <main>
      <PageHead title="کتابخانه استانداردها و پروتکل‌ها" crumbs="کابین › تحویل" sub="برای هر نوع کار یک پروتکل نسخه‌دار؛ هر پروژه با پروتکلش به همکار داده و موقع تحویل با همان سنجیده می‌شود." actions={<button className="btn primary">✦ پیش‌نویس پروتکل تازه</button>} />
      <div className="grid g3">
        {protocols.map((p) => (
          <Link key={p.id} href={`/cockpit/protocols/${p.id}`} className="card stack" style={{ color: "inherit", textDecoration: "none" }}>
            <div className="card-head"><h3>{p.title}</h3><span className="more badge">{p.version}</span></div>
            <div className="muted small">{p.category}</div>
            <div className="row small"><span>{p.used} بار استفاده</span><span className="spacer" /><span>قبول در بار اول: {p.passRate}٪</span></div>
            <Progress value={p.passRate} />
          </Link>
        ))}
      </div>
    </main>
  );
}
