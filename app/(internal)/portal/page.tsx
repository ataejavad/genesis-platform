import Link from "next/link";
import { customer, customerApprovals, fmtEur, insights, onboarding, projects } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Progress, StatusBadge } from "@/ui/bits";
import { ActionButton } from "@/ui/site/SiteClient";

// Results first (doc 15 §6و): ROI, what needs the customer, proactive insights, next step.
export default function PortalHome() {
  const mine = projects.filter((p) => p.customerCode === customer.id);
  const saved = customer.savedHours * 38;
  const done = onboarding.filter((o) => o.done).length;
  return (
    <main>
      <PageHead title={`سلام ${customer.contact} 👋`} crumbs={customer.name} sub="اول نتیجه: این ماه AI برای شما چه کرد." actions={<><ActionButton className="btn" label="＋ درخواست راه‌حل تازه" done="درخواست ثبت شد؛ مشاور AI تا امروز پیشنهاد می‌دهد" /><Link href="/portal/advisor" className="btn primary">✦ مشاور AI</Link></>} />

      <section className="card" style={{ marginBottom: 18, background: "linear-gradient(135deg, var(--brand-soft), var(--panel))" }}>
        <div className="row" style={{ gap: 28 }}>
          <div><div className="muted small">بازگشت سرمایه این ماه</div><div style={{ fontSize: 36, fontWeight: 800 }} className="num">{(saved / customer.monthlyFee).toFixed(1)}×</div></div>
          <div><div className="muted small">صرفه‌جویی</div><div style={{ fontSize: 24, fontWeight: 800 }} className="num">{customer.savedHours} ساعت ≈ {fmtEur(saved)}</div></div>
          <div><div className="muted small">هزینه شما</div><div style={{ fontSize: 24, fontWeight: 800 }} className="num">{fmtEur(customer.monthlyFee)}</div></div>
          <div><div className="muted small">کار برنده‌شده با کمک AI</div><div style={{ fontSize: 24, fontWeight: 800 }} className="num">{customer.wonJobs}</div></div>
          <div><div className="muted small">از اول همکاری</div><div style={{ fontSize: 24, fontWeight: 800 }} className="num">{fmtEur(7860)}</div></div>
        </div>
      </section>

      <section className="grid g3" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card-head"><h3>✋ منتظر تأیید شما</h3><span className="badge warn">{customerApprovals.length}</span></div>
          <div className="list">{customerApprovals.map((a) => <div key={a.t} className="item"><div className="grow small">{a.t}<div className="muted">{a.kind}</div></div><ActionButton className="btn sm ok" label="تأیید" done="تأیید شد" /></div>)}</div>
        </div>
        <div className="card">
          <h3>✦ بینش‌های تازه</h3>
          <div className="stack">{insights.map((i) => <div key={i.t} className={`callout ${i.tone === "warn" ? "warn" : i.tone === "ai" ? "ai" : ""} small`}>{i.t}<div style={{ marginTop: 6 }}><ActionButton className="btn sm" label={i.act} done="به تیم سپرده شد" /></div></div>)}</div>
        </div>
        <div className="card">
          <div className="card-head"><h3>🚀 شروع کار</h3><span className="more muted">{done} از {onboarding.length}</span></div>
          <Progress value={Math.round((done / onboarding.length) * 100)} />
          <div className="list" style={{ marginTop: 8 }}>{onboarding.map((o) => <div key={o.t} className="item small"><span>{o.done ? "✅" : "⬜"}</span><div className="grow" style={{ opacity: o.done ? 0.6 : 1 }}>{o.t}</div></div>)}</div>
        </div>
      </section>

      <section className="grid g-2-1" style={{ marginBottom: 18 }}>
        <div className="card">
          <div className="card-head"><h3>کار در جریان</h3><Link className="more" href="/portal/projects">همه</Link></div>
          <div className="list">
            {mine.map((p) => (
              <Link href={`/portal/projects/${p.id}`} className="item" key={p.id} style={{ color: "inherit", textDecoration: "none" }}>
                <div className="grow"><b>{p.title}</b><div style={{ marginTop: 6 }}><Progress value={p.progress} /></div></div>
                <StatusBadge status={p.status} />
              </Link>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>📊 شما در برابر هم‌صنف‌ها</h3>
          <div className="muted small" style={{ marginBottom: 8 }}>بی‌نام، از ۴۸ شیشه‌بری آلمانی هم‌اندازه</div>
          {[["زمان قیمت‌دهی", 92], ["تماس پاسخ‌داده", 88], ["پیگیری پیشنهادها", 41]].map(([l, v]) => (
            <div key={l} style={{ marginBottom: 10 }}><div className="row small"><span>{l}</span><span className="spacer" /><b>بهتر از {v}٪</b></div><Progress value={Number(v)} /></div>
          ))}
          <Link href="/portal/services" className="btn sm">بهبود «پیگیری» ←</Link>
        </div>
      </section>

      <section className="card row">
        <b>این ماه چقدر از ما راضی بودید؟</b>
        <span className="spacer" />
        {[...Array(11).keys()].map((n) => <button key={n} className="chip" style={{ padding: "4px 9px" }} aria-label={`NPS ${n}`}>{n}</button>)}
      </section>
    </main>
  );
}
