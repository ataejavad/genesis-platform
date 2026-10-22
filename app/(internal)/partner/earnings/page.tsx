import { earnings, fmtEur } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Tone } from "@/ui/bits";

export default function PartnerEarnings() {
  return (
    <main>
      <PageHead title="درآمد و تسویه" crumbs="پورتال همکاران" sub="پرداخت ظرف ۱۴ روز بعد از قبول تحویل؛ صورتحساب خودکار ساخته می‌شود." />
      <div className="card">
        <table className="table"><thead><tr><th>دوره</th><th>پروژه</th><th>مبلغ</th><th>وضعیت</th><th></th></tr></thead>
          <tbody>{earnings.map((e) => (<tr key={e.project}><td>{e.period}</td><td className="ltr">{e.project}</td><td className="num">{fmtEur(e.amount)}</td><td><Tone text={e.status} /></td><td><button className="btn sm">صورتحساب</button></td></tr>))}</tbody></table>
      </div>
    </main>
  );
}
