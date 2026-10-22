import { applications, partners } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Tone } from "@/ui/bits";

export default function Partners() {
  return (
    <main>
      <PageHead title="همکاران" crumbs="کابین › تحویل" sub="همه کسانی که برای ما یا از طریق ما کار می‌کنند: همکار داخلی، تأمین‌کننده تحویل، ایجنت." actions={<><button className="btn">+ دعوت همکار</button><button className="btn primary">✦ شکار تأمین‌کننده برای فیلتر فعال</button></>} />
      <h2>درخواست‌های تازه</h2>
      <div className="grid g3" style={{ marginBottom: 22 }}>
        {applications.map((a) => (
          <div className="card stack" key={a.name}>
            <div className="card-head"><span className="avatar">{a.name[0]}</span><div><b>{a.name}</b><div className="muted small">{a.kind} · {a.country}</div></div><span className="more badge ai">AI {a.aiScore}</span></div>
            <div className="small"><b>برای:</b> {a.for}</div>
            <div className="callout ai small">{a.summary}</div>
            <div className="row"><button className="btn sm ok">پذیرش و قرارداد</button><button className="btn sm">مصاحبه</button><button className="btn sm danger">رد</button></div>
          </div>
        ))}
      </div>
      <h2>همکاران فعال</h2>
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>کد</th><th>نام</th><th>نوع</th><th>نقش</th><th>کشور</th><th>مهارت‌ها</th><th>امتیاز</th><th>قبول در بار اول</th><th>به‌موقع</th><th>وضعیت</th></tr></thead>
          <tbody>
            {partners.map((p) => (
              <tr key={p.code}>
                <td className="ltr">{p.code}</td><td><b>{p.name}</b></td><td>{p.kind}</td><td>{p.role}</td><td>{p.country}</td>
                <td>{p.skills.map((s) => <span key={s} className="badge gray" style={{ marginInlineEnd: 4 }}>{s}</span>)}</td>
                <td className="num">{p.score ? `★ ${p.score}` : "—"}</td><td className="num">{p.firstPass ? `${p.firstPass}٪` : "—"}</td><td className="num">{p.onTime ? `${p.onTime}٪` : "—"}</td>
                <td><Tone text={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
