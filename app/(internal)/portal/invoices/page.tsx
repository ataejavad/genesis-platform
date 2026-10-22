import { fmtEur, invoices } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Tone } from "@/ui/bits";

export default function PortalInvoices() {
  return (
    <main>
      <PageHead title="فاکتورها" crumbs="پورتال مشتری" sub="پرداخت با انتقال بانکی SEPA؛ شماره حساب روی هر فاکتور." />
      <div className="card">
        <table className="table"><thead><tr><th>شماره</th><th>دوره</th><th>مبلغ</th><th>وضعیت</th><th></th></tr></thead>
          <tbody>{invoices.map((i) => (<tr key={i.no}><td className="ltr">{i.no}</td><td>{i.period}</td><td className="num">{fmtEur(i.amount)}</td><td><Tone text={i.status} /></td><td><button className="btn sm">PDF</button></td></tr>))}</tbody></table>
      </div>
    </main>
  );
}
