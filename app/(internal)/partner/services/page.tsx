import { PageHead } from "@/ui/Shell";

const myServices = [
  { t: "اتصال CRM (HubSpot، Pipedrive)", price: "€90/ساعت یا بسته €700", protocol: "اتصال CRM v1" },
  { t: "ورک‌فلو n8n", price: "€80/ساعت", protocol: "اتوماسیون n8n v1" },
];
const week = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const cap = [6, 6, 4, 0, 8, 8, 0];

export default function PartnerServices() {
  return (
    <main>
      <PageHead title="خدمات و ظرفیت" crumbs="پورتال همکاران" sub="ظرفیت را خودتان اعلام می‌کنید؛ ما فقط بر اساس آن کار پیشنهاد می‌دهیم و ساعت کارتان را ردیابی نمی‌کنیم." actions={<button className="btn primary">＋ خدمت تازه</button>} />
      <section className="grid g2">
        <div className="card"><h3>خدمات من</h3><div className="list">{myServices.map((s) => <div key={s.t} className="item"><div className="grow"><b>{s.t}</b><div className="muted small">{s.price} · 📐 {s.protocol}</div></div><button className="btn sm">ویرایش</button></div>)}</div></div>
        <div className="card"><h3>ظرفیت این هفته (ساعت)</h3>
          <div className="grid" style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
            {week.map((d, i) => <label key={d} className="field small" style={{ textAlign: "center" }}>{d}<input defaultValue={cap[i]} className="num" style={{ textAlign: "center" }} /></label>)}
          </div>
          <label className="choice" style={{ marginTop: 12 }}><input type="checkbox" /> مرخصی: پیشنهاد کار نفرست</label>
        </div>
      </section>
    </main>
  );
}
