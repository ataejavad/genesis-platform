import { leads } from "@/mock/data";
import { PageHead } from "@/ui/Shell";

const stages = ["سرنخ", "چک‌آپ انجام شد", "جلسه", "مشتری"];

export default function Leads() {
  return (
    <main>
      <PageHead title="سرنخ‌ها و مشتری‌ها" crumbs="کابین › فروش" sub="CRM ساده؛ ایجنت شکارچی سرنخ پر می‌کند و ایجنت پیشنهاد، پیام شخصی می‌نویسد." actions={<><button className="btn">+ سرنخ دستی</button><button className="btn primary">✦ پیدا کردن ۵۰ سرنخ تازه</button></>} />
      <div className="kanban">
        {stages.map((st) => (
          <div className="col" key={st}>
            <h4>{st} <span className="badge gray">{leads.filter((l) => l.stage === st).length}</span></h4>
            {leads.filter((l) => l.stage === st).map((l) => (
              <div className="task" key={l.company}>
                <b>{l.company}</b>
                <div className="muted small">{l.city} · {l.industry}</div>
                <div className="meta"><span className="badge">امتیاز {l.score}</span><span>{l.source}</span></div>
                <div className="small" style={{ marginTop: 6 }}>بعدی: {l.next}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
