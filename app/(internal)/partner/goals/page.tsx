import { PageHead } from "@/ui/Shell";
import { Progress } from "@/ui/bits";

// Internal contributors (e.g. our marketer) get goals and KPIs instead of a job inbox (doc 15 §6ب).
const kpis = [
  { t: "پست لینکدین منتشرشده (صنعت شیشه آلمان)", v: 7, goal: 12 },
  { t: "سرنخ از محتوا", v: 18, goal: 30 },
  { t: "عضو تازه خبرنامه هاب", v: 64, goal: 100 },
];

export default function Goals() {
  return (
    <main>
      <PageHead title="اهداف و KPI" crumbs="پورتال همکاران › همکار داخلی" sub="نمونه برای Sara K. (بازاریاب). این بخش فقط برای همکاران داخلی است." />
      <div className="grid g3">{kpis.map((k) => <div key={k.t} className="card"><div className="muted small">{k.t}</div><div style={{ fontSize: 26, fontWeight: 800 }} className="num">{k.v} / {k.goal}</div><Progress value={Math.round((k.v / k.goal) * 100)} /></div>)}</div>
    </main>
  );
}
