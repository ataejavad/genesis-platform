import Link from "next/link";
import { appModeLabel, connections, myApps } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Tone } from "@/ui/bits";

// "My Apps" (doc 15 §6و): everything the customer bought, used inside our dashboard — native, embedded or SSO.
export default function MyApps() {
  return (
    <main>
      <PageHead title="اپ‌های من" crumbs="پورتال مشتری" sub="هر چیزی که خریده‌اید همین‌جاست و همه کارش داخل همین داشبورد انجام می‌شود." actions={<Link className="btn primary" href="/fa-ir/market?hub=glass-de">＋ افزودن از بازار</Link>} />
      <section className="grid g3" style={{ marginBottom: 20 }}>
        {myApps.map((a) => (
          <Link key={a.id} href={`/portal/apps/${a.id}`} className="tile">
            <div className="row"><span className="ico">{a.icon}</span><div style={{ flex: 1 }}><b>{a.name}</b><div className="muted small">{appModeLabel[a.mode]}</div></div><Tone text={a.status} /></div>
            <div className="small">{a.stat}</div>
            <span className="btn sm" style={{ justifySelf: "start" }}>{a.mode === "sso" ? "↗ باز کردن" : "باز کردن"}</span>
          </Link>
        ))}
      </section>
      <div className="card">
        <div className="card-head"><h3>🔌 اتصال به ابزارهای خود شما</h3><button className="btn sm more">＋ اتصال تازه</button></div>
        <table className="table"><thead><tr><th>ابزار</th><th>نوع</th><th>وضعیت</th><th /></tr></thead>
          <tbody>{connections.map((c) => <tr key={c.name}><td>{c.name}</td><td className="ltr">{c.kind}</td><td><Tone text={c.status === "وصل" ? "فعال" : "منتظر"} /></td><td><button className="btn sm">مدیریت</button></td></tr>)}</tbody>
        </table>
        <p className="muted small" style={{ marginTop: 8 }}>اتصال‌ها با OAuth یا کلید API انجام می‌شود و ما مدیریتشان می‌کنیم. کلیدها در گاوصندوق رمز نگه داشته می‌شوند، نه در داشبورد.</p>
      </div>
    </main>
  );
}
