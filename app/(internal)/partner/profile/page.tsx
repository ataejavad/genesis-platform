import { PageHead } from "@/ui/Shell";

const myServices = [
  { name: "اتصال CRM (HubSpot، Pipedrive)", model: "پروژه‌ای", price: "€700 تا €1,200", sla: "۵ روز" },
  { name: "اتوماسیون Zapier / n8n", model: "ساعتی", price: "€45/ساعت", sla: "—" },
];

export default function PartnerProfile() {
  return (
    <main>
      <PageHead title="پروفایل، رزومه و خدمات" crumbs="پورتال همکاران" sub="همین اطلاعات برای تخصیص کار و امتیاز استفاده می‌شود." actions={<span className="badge ok">احراز شده</span>} />
      <section className="grid g2">
        <div className="card stack">
          <h3>اطلاعات و رزومه</h3>
          <label className="field">نام<input defaultValue="Marco Rossi" /></label>
          <label className="field">نوع<select defaultValue="freelancer"><option value="freelancer">فریلنسر</option><option>شرکت</option><option>ایجنت / API</option></select></label>
          <label className="field">کشور و زبان‌ها<input defaultValue="ایتالیا · ایتالیایی، انگلیسی" /></label>
          <label className="field">مهارت‌ها<input defaultValue="HubSpot, Zapier, REST API, n8n" /></label>
          <label className="field">رزومه (PDF)<input type="file" /></label>
          <button className="btn primary">ذخیره</button>
        </div>
        <div className="stack">
          <div className="card">
            <div className="card-head"><h3>خدمات من</h3><button className="more btn sm">+ خدمت</button></div>
            <table className="table"><thead><tr><th>خدمت</th><th>مدل</th><th>قیمت شما</th><th>زمان</th></tr></thead>
              <tbody>{myServices.map((s) => (<tr key={s.name}><td>{s.name}</td><td>{s.model}</td><td>{s.price}</td><td>{s.sla}</td></tr>))}</tbody></table>
          </div>
          <div className="card"><h3>🔐 گاوصندوق مدارک (با یادآوری انقضا)</h3><div className="list">
            <div className="item">📝<div className="grow">قرارداد همکاری (عدم دور زدن، وایت‌لیبل)</div><span className="badge ok">امضاشده</span></div>
            <div className="item">🔒<div className="grow">قرارداد پردازش داده (DPA)</div><span className="badge ok">امضاشده</span></div>
            <div className="item">🛡️<div className="grow">بیمه مسئولیت حرفه‌ای</div><span className="badge warn">تا ۱۴۰۵/۰۹ معتبر</span></div>
          </div></div>
        </div>
      </section>
    </main>
  );
}
