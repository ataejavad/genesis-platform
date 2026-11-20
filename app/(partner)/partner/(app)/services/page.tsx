import { partnerCopy } from "@/config/partner-copy";
import { fmtEur } from "@/config/portal-copy";
import { getDb } from "@/db";
import { requirePartner } from "@/lib/partner-auth";
import { SKILLS, skillLabel } from "@/server/partner-rules";
import { servicesFor } from "@/server/partners";
import { dropService, saveCapacity, saveService } from "@/ui/partner/actions";
import { PageHead } from "@/ui/Shell";

export default async function PartnerServices() {
  const { partner, lang } = await requirePartner();
  const t = partnerCopy(lang);
  const p = t.page.services;
  const services = await servicesFor(getDb(), partner.id);
  return (
    <main className="stack" style={{ maxWidth: 860 }}>
      <PageHead title={p.title} sub={p.sub} />
      <form action={saveCapacity} className="card row" style={{ flexWrap: "wrap", gap: 12 }}>
        <label className="field" style={{ maxWidth: 260 }}>{p.capacity}<input name="capacity" type="number" min={0} max={20} defaultValue={partner.capacity} /></label>
        <label className="row small"><input type="checkbox" name="paused" defaultChecked={partner.status === "paused"} style={{ width: "auto" }} /> {p.pause}</label>
        <button className="btn primary">{p.save}</button>
      </form>
      <div className="card list">
        {services.map((s) => (
          <form key={s.id} action={dropService} className="item">
            <input type="hidden" name="id" value={s.id} />
            <div className="grow"><b>{s.title}</b><div className="muted small">{s.skills.map((x) => skillLabel(x, lang)).join(", ")} · {p.models[s.priceModel]} {fmtEur(s.priceEur, lang)} · {s.deliveryDays} {p.days.toLowerCase()}</div></div>
            <button className="btn sm danger">{p.remove}</button>
          </form>
        ))}
      </div>
      <form action={saveService} className="card stack">
        <h3>{p.add}</h3>
        <label className="field">{p.titleF}<input name="title" required minLength={3} /></label>
        <div className="grid g3">
          <label className="field">{p.model}<select name="model">{Object.entries(p.models).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="field">{p.price}<input name="price" type="number" min={1} required /></label>
          <label className="field">{p.days}<input name="days" type="number" min={1} defaultValue={5} required /></label>
        </div>
        <fieldset className="row" style={{ flexWrap: "wrap", border: 0, padding: 0, gap: 6 }}>
          <legend className="small">{p.skills}</legend>
          {SKILLS.map((s) => <label key={s.id} className="choice small" style={{ padding: "4px 10px" }}><input type="checkbox" name="skills" value={s.id} defaultChecked={partner.skills.includes(s.id)} /> {skillLabel(s.id, lang)}</label>)}
        </fieldset>
        <button className="btn primary">{p.add}</button>
      </form>
    </main>
  );
}
