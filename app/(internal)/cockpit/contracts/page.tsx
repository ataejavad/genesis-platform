import { contracts } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Tone } from "@/ui/bits";
import { ContractFactory } from "./factory";

export default function Contracts() {
  return (
    <main>
      <PageHead title="کارخانه قرارداد" crumbs="کابین › فروش" sub="اطلاعات پایه را بده؛ قرارداد از قالب بازبینی‌شده همان نوع و کشور ساخته می‌شود، اینجا ویرایش و بعد برای امضا فرستاده می‌شود." />
      <ContractFactory />
      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-head"><h3>قراردادها</h3></div>
        <table className="table">
          <thead><tr><th>نوع</th><th>طرف</th><th>قالب</th><th>وضعیت</th><th>تمدید</th></tr></thead>
          <tbody>
            {contracts.map((c) => (
              <tr key={c.party + c.title}><td>{c.title}</td><td>{c.party}</td><td className="ltr">{c.template}</td><td><Tone text={c.status} /></td><td>{c.renew}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
