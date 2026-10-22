import Link from "next/link";
import { customer, projects } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Progress, StatusBadge } from "@/ui/bits";

export default function PortalProjects() {
  const mine = projects.filter((p) => p.customerCode === customer.id);
  return (
    <main>
      <PageHead title="پروژه‌ها" crumbs="پورتال مشتری" actions={<button className="btn primary">+ درخواست کار تازه</button>} />
      <div className="grid g2">
        {mine.map((p) => (
          <Link key={p.id} href={`/portal/projects/${p.id}`} className="card stack" style={{ color: "inherit", textDecoration: "none" }}>
            <div className="card-head"><h3>{p.title}</h3><span className="more"><StatusBadge status={p.status} /></span></div>
            <Progress value={p.progress} />
            <div className="row small muted"><span>{p.progress}٪</span><span className="spacer" /><span>تحویل: {p.due}</span></div>
          </Link>
        ))}
      </div>
    </main>
  );
}
