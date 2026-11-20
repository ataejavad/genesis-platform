import Link from "next/link";
import type { SiteCopy } from "@/config/site-copy";
import { pick, products } from "@/mock/site";
import type { LockedReport, Report } from "@/server/checkup";

const euro = (n: number, lang: string) => new Intl.NumberFormat(lang, { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
const num = (n: number, lang: string) => n.toLocaleString(lang, { maximumFractionDigits: 2 });

/** The check-up result, shared by the form, the chat and the report link. Solutions appear only when unlocked. */
export function CheckupReport({ report, c, locale, compact, only }: { report: LockedReport | Report; c: SiteCopy["checkup"]; locale: string; compact?: boolean; only?: "plan" }) {
  const lang = locale.slice(0, 2);
  const full = "solution" in (report.leaks[0] ?? {}) ? (report as Report) : null;
  const top = full?.leaks[0];
  const product = (slug: string) => products.find((p) => p.slug === slug);
  return (
    <div className="stack checkup-report" style={{ gap: 12 }}>
      {only !== "plan" && <>
      <div className="card stat">
        <div className="label">{c.total}</div>
        <div className="value num">{euro(report.total, lang)}</div>
        {report.payrollPct !== null && <div className="delta muted">{c.payroll.replace("{p}", num(report.payrollPct, lang))}</div>}
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>{c.leaks}</h3>
        <div className="list">
          {report.leaks.map((l) => (
            <div key={l.id} className="item" style={{ alignItems: "flex-start" }}>
              <div className="grow">
                <b>{l.title}</b> <span className="badge warn">{euro(l.amount, lang)}</span>
                <div className="muted small">{l.why}</div>
                {!compact && (
                  <details className="small">
                    <summary>{c.how}</summary>
                    <span className="ltr">{l.factors.map((f) => num(f.value, lang)).join(" × ")} = {euro(l.amount, lang)}</span>
                    <ul>{l.factors.map((f) => <li key={f.label}>{num(f.value, lang)}: {f.label}</li>)}</ul>
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="muted small">{c.basis}</p>
      </div>
      {report.deadlines.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>⏰ {c.deadlines}</h3>
          <ul>{report.deadlines.map((d) => <li key={d.id}><Link href={d.url}>{d.date ? <b>{d.date} </b> : null}{d.title}</Link></li>)}</ul>
        </div>
      )}
      </>}
      {full && top && (
        <div className="card hook">
          <h3 style={{ marginTop: 0 }}>✦ {c.plan}</h3>
          <p>
            {full.advice ??
              c.summary
                .replace("{top}", top.title)
                .replace("{amount}", euro(top.amount, lang))
                .replace("{solution}", product(top.solution) ? pick(product(top.solution)!.name, locale) : top.solution)
                .replace("{x}", num(top.payback ?? 0, lang))}
          </p>
          <div className="list">
            {full.leaks.map((l, i) => {
              const p = product(l.solution);
              return (
                <div key={l.id} className="item">
                  <span className="badge">{i + 1}</span>
                  <div className="grow">
                    <b>{p ? `${p.icon} ${pick(p.name, locale)}` : l.solution}</b>
                    {p && <div className="small">{pick(p.outcome, locale)}</div>}
                    <div className="muted small">
                      {l.priceMonth !== null && c.from.replace("{p}", String(l.priceMonth))}
                      {l.payback !== null && ` · ${c.payback.replace("{x}", num(l.payback, lang))}`}
                    </div>
                  </div>
                  <Link className="btn sm" href={`/${locale}/market/${l.solution}?industry=${full.industry}&country=${full.country.toLowerCase()}`}>{c.details}</Link>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
