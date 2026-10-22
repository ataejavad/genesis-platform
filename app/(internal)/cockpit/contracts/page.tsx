import { contracts, countryPacks } from "@/mock/cockpit";
import { PageHead } from "@/ui/Shell";
import { Factory } from "./factory";

export default function Contracts() {
  return (
    <main>
      <PageHead title="Contracts" crumbs="Cockpit › Money & legal" sub="One button on every relationship: the contract agent gathers the data and conversations, picks the type and annexes, applies the country pack. You read a one-page summary and sign." />
      <Factory />
      <section className="grid g2" style={{ marginTop: 18 }}>
        <div className="card table-wrap"><h3>Country packs</h3><table className="table"><thead><tr><th>Country</th><th>Law</th><th>Data protection</th><th>Tax</th><th>E-invoice</th><th>Currency</th><th>Status</th></tr></thead>
          <tbody>{countryPacks.map((c) => <tr key={c.country}><td>{c.country}</td><td>{c.law}</td><td className="small">{c.dp}</td><td className="small">{c.tax}</td><td className="small">{c.einv}</td><td>{c.cur}</td><td><span className={`badge ${c.status === "ready" ? "ok" : c.status === "lawyer review" ? "warn" : "gray"}`}>{c.status}</span></td></tr>)}</tbody></table>
          <p className="muted small">Templates live in Git, lawyer-reviewed once per country. A pack is built only when a first customer there is near.</p></div>
        <div className="card"><h3>Contract archive</h3><table className="table"><thead><tr><th>Contract</th><th>Party</th><th>Pack</th><th>Status</th><th>Renewal</th></tr></thead>
          <tbody>{contracts.map((c) => <tr key={c.party}><td>{c.title}</td><td>{c.party}</td><td>{c.pack}</td><td><span className={`badge ${c.status === "Signed" ? "ok" : "warn"}`}>{c.status}</span></td><td>{c.renew}</td></tr>)}</tbody></table></div>
      </section>
    </main>
  );
}
