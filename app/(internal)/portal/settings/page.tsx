import { activity } from "@/mock/data";
import { PageHead } from "@/ui/Shell";

const team = [
  { n: "Thomas Becker", r: "مالک" },
  { n: "Anna Becker", r: "حسابداری" },
  { n: "Jonas Klein", r: "کاربر" },
];

export default function Settings() {
  return (
    <main>
      <PageHead title="تنظیمات و تیم" crumbs="پورتال مشتری" />
      <section className="grid g2" style={{ marginBottom: 18 }}>
        <div className="card"><div className="card-head"><h3>کاربران شرکت</h3><button className="btn sm more">＋ دعوت</button></div>
          <div className="list">{team.map((u) => <div key={u.n} className="item"><span className="avatar">{u.n[0]}</span><div className="grow">{u.n}</div><select defaultValue={u.r} style={{ width: "auto" }}><option>مالک</option><option>مدیر</option><option>کاربر</option><option>حسابداری</option></select></div>)}</div>
        </div>
        <div className="card stack"><h3>ترجیحات</h3>
          <label className="field">زبان<select defaultValue="Deutsch"><option>Deutsch</option><option>English</option><option>Italiano</option><option>فارسی</option></select></label>
          <label className="field">اعلان‌ها<select><option>ایمیل + واتس‌اپ</option><option>ایمیل + تلگرام</option><option>فقط ایمیل</option></select></label>
          <label className="choice"><input type="checkbox" defaultChecked /> ورود دومرحله‌ای</label>
        </div>
      </section>
      <div className="card"><h3>گزارش فعالیت تیم</h3>
        <table className="table"><thead><tr><th>چه کسی</th><th>چه کرد</th><th>کی</th></tr></thead><tbody>{activity.map((a) => <tr key={a.what}><td>{a.who}</td><td>{a.what}</td><td>{a.when}</td></tr>)}</tbody></table>
      </div>
    </main>
  );
}
