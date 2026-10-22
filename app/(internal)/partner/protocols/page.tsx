import { protocols } from "@/mock/data";
import { PageHead } from "@/ui/Shell";

export default function PartnerProtocols() {
  return (
    <main>
      <PageHead title="پروتکل‌ها و استانداردها" crumbs="پورتال همکاران" sub="هر کار با این معیارها سنجیده می‌شود. پروتکل «چه چیزی و با چه کیفیتی» را می‌گوید، نه «چطور و کی»." />
      <div className="card"><table className="table"><thead><tr><th>پروتکل</th><th>نسخه</th><th>دسته</th><th>نرخ قبول همه همکاران</th></tr></thead>
        <tbody>{protocols.map((p) => <tr key={p.id}><td><b>{p.title}</b></td><td className="ltr">{p.version}</td><td>{p.category}</td><td className="num">{p.passRate}٪</td></tr>)}</tbody></table></div>
    </main>
  );
}
