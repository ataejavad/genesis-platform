import { ladder, services } from "@/mock/data";
import { PageHead } from "@/ui/Shell";

export default function PortalServices() {
  const active = new Set(services.map((s) => s.step));
  return (
    <main>
      <PageHead title="خدمات و نردبان رشد" crumbs="پورتال مشتری" sub="جای شما روی نردبان، و پله بعدی." />
      <div className="ladder" style={{ marginBottom: 20 }}>
        {ladder.map((s) => (
          <div key={s.n} className={`rung ${active.has(s.n) ? "free" : ""}`}>
            <div className="n">{s.n}</div>
            <b>{s.title}</b>
            <p className="muted small" style={{ marginTop: 6 }}>{s.desc}</p>
            <div className="row"><span className="small">{s.price}</span><span className="spacer" />{active.has(s.n) ? <span className="badge ok">فعال</span> : s.n > 1 ? <button className="btn sm">درخواست</button> : <span className="badge gray">انجام شد</span>}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>خدمات فعال شما</h3>
        <table className="table"><thead><tr><th>خدمت</th><th>از</th><th>نتیجه</th><th>ماهانه</th></tr></thead>
          <tbody>{services.map((s) => (<tr key={s.id}><td>{s.name}</td><td>{s.since}</td><td>{s.kpi}</td><td className="num">€{s.fee}</td></tr>))}</tbody></table>
      </div>
    </main>
  );
}
