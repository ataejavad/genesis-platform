import { contracts, fmtEur, invoices } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Tone } from "@/ui/bits";

export default function Billing() {
  const mine = contracts.filter((c) => c.party === "Glas Becker GmbH");
  return (
    <main>
      <PageHead title="قرارداد و فاکتور" crumbs="پورتال مشتری" sub="پرداخت فعلاً با انتقال SEPA؛ پرداخت آنلاین (Stripe) به‌زودی." />
      <section className="grid g2">
        <div className="card"><h3>فاکتورها</h3>
          <table className="table"><thead><tr><th>شماره</th><th>دوره</th><th>مبلغ</th><th>وضعیت</th><th /></tr></thead>
            <tbody>{invoices.map((i) => (<tr key={i.no}><td className="ltr">{i.no}</td><td>{i.period}</td><td className="num">{fmtEur(i.amount)}</td><td><Tone text={i.status} /></td><td><button className="btn sm">PDF</button></td></tr>))}</tbody></table>
          <div className="callout small" style={{ marginTop: 12 }}>IBAN و کد پرداخت روی هر فاکتور است. فاکتور الکترونیک طبق قانون کشور شما صادر می‌شود.</div>
        </div>
        <div className="card"><h3>قراردادها</h3>
          <div className="list">{mine.map((c) => <div key={c.title} className="item">📄<div className="grow"><b>{c.title}</b><div className="muted small">تمدید: {c.renew}</div></div><Tone text={c.status} /><button className="btn sm">PDF</button></div>)}</div>
          <div className="list"><div className="item">📄<div className="grow"><b>الحاقیه: قیمت شیشه رنگی</b><div className="muted small">از درخواست تغییر · +€180</div></div><span className="badge warn">منتظر امضای شما</span></div></div>
        </div>
      </section>
    </main>
  );
}
