"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { cancelNow, complainNow, confirmBrief, decide, orderPackage, sendRequest } from "./actions";
import { journeyCopy } from "@/config/journey-copy";
import { fmtEur, fmtNum, NUM_LOCALE, type PortalCopy } from "@/config/portal-copy";
import { metricHow, metricLabel } from "@/server/portal-metrics";
import type { Card } from "@/server/portal-chat";

type P = { t: PortalCopy; lang: string };
const num = fmtNum;
const dayOf = (iso: string, lang: string, time = false) => new Intl.DateTimeFormat(NUM_LOCALE[lang] ?? "en-GB", time ? { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" } : { dateStyle: "medium" }).format(new Date(iso));
const pct = (n: number, lang: string) => new Intl.NumberFormat(NUM_LOCALE[lang] ?? "en-GB", { style: "percent", maximumFractionDigits: 0 }).format(n);

export function ResultsCard({ data: r, t, lang, full }: P & { data: Extract<Card, { type: "results" }>["data"]; full?: boolean }) {
  const c = t.card;
  const max = Math.max(1, ...r.series.map((s) => s.eur));
  return (
    <div className="card pcard">
      <div className="row" style={{ gap: 24, flexWrap: "wrap" }}>
        <div><div className="muted small">{c.month}</div><div className="big num">{fmtEur(r.month.eur, lang)}</div></div>
        <div><div className="muted small">{c.fee}</div><div className="mid num">{fmtEur(r.feeEur, lang)}</div></div>
        {r.roi !== null && <div><div className="muted small">{c.roi}</div><div className="mid num">{num(r.roi, lang)}×</div></div>}
        <div><div className="muted small">{c.since}</div><div className="mid num">{fmtEur(r.sinceStart.eur, lang)}</div></div>
      </div>
      {r.recovered !== null && r.baselineEur !== null && (
        <div style={{ marginTop: 12 }}>
          <div className="progress" aria-hidden><span style={{ width: `${Math.round(r.recovered * 100)}%` }} /></div>
          <div className="small" style={{ marginTop: 4 }}><b>{pct(r.recovered, lang)}</b> {c.recovered} · <span className="muted">{c.baseline.replace("{eur}", fmtEur(r.baselineEur, lang))}</span></div>
        </div>
      )}
      {r.month.byMetric.length > 0 && (
        <ul className="plist">
          {r.month.byMetric.map((m) => (
            <li key={m.metric}>
              <span className="num"><b>{num(m.value, lang)}</b></span> {metricLabel(m.metric, lang)}
              <span className="spacer" /> <b className="num">{fmtEur(m.eur, lang)}</b>
              {full && <div className="muted small">{c.how}: {metricHow(m.metric, lang)}</div>}
            </li>
          ))}
        </ul>
      )}
      <div className="muted small" style={{ marginTop: 8 }}>{c.trend}</div>
      <div className="bars" role="img" aria-label={r.series.map((s) => `${s.month}: ${fmtEur(s.eur, lang)}`).join(", ")}>
        {r.series.map((s) => <div key={s.month} title={`${s.month}: ${fmtEur(s.eur, lang)}`}><span style={{ height: `${Math.max(3, (s.eur / max) * 100)}%` }} /><small>{s.month.slice(5)}</small></div>)}
      </div>
    </div>
  );
}

export function GoalsCard({ data, t, lang }: P & { data: Extract<Card, { type: "goals" }>["data"] }) {
  return (
    <div className="card pcard stack">
      {data.map((g) => (
        <div key={g.id}>
          <div className="row small"><b>{g.title}</b><span className="spacer" /><span className="num">{t.card.goal.replace("{cur}", num(g.current, lang)).replace("{target}", num(g.target, lang)).replace("{unit}", t.units[g.unit] ?? g.unit)}</span></div>
          <div className="progress" aria-label={pct(g.progress, lang)}><span style={{ width: `${Math.round(g.progress * 100)}%` }} /></div>
          {g.due && <div className="muted small">{t.card.due.replace("{d}", g.due)}</div>}
        </div>
      ))}
    </div>
  );
}

export function ApprovalsCard({ data, t, lang, onDone }: P & { data: Extract<Card, { type: "approvals" }>["data"]; onDone?: (text: string) => void }) {
  const j = journeyCopy(lang).approval;
  const [done, setDone] = useState<Record<string, string>>({});
  const [stars, setStars] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const act = (id: string, d: "approved" | "changes") =>
    start(async () => {
      // "Ask for changes" sends what the customer wrote in the sentence box as the change to make
      const r = await decide(id, d, d === "changes" ? notes[id] : undefined, stars[id], d === "approved" ? notes[id] : undefined);
      setDone((x) => ({ ...x, [id]: r.text }));
      onDone?.(r.text);
    });
  return (
    <div className="card pcard list">
      {data.map((a) => (
        <div className="item" key={a.id}>
          <div className="grow small">
            <b>{a.title}</b>{a.detail && <div className="muted">{a.detail}</div>}{a.link && <a href={a.link} target="_blank" rel="noopener">{t.card.open} ↗</a>}
            {a.autoOn && <div className="muted">⏳ {j.autoOn.replace("{d}", dayOf(a.autoOn, lang))}</div>}
            {a.milestone && !done[a.id] && (
              <div className="stack" style={{ gap: 4, marginTop: 6 }}>
                <div className="row" style={{ gap: 2, flexWrap: "wrap" }} role="radiogroup" aria-label={j.rate}>
                  <span className="muted" style={{ marginInlineEnd: 6 }}>{j.rate}</span>
                  {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={stars[a.id] === n} aria-label={j.stars.replace("{n}", String(n))} className="btn sm" style={{ padding: "0 6px", opacity: (stars[a.id] ?? 0) >= n ? 1 : 0.35 }} onClick={() => setStars((x) => ({ ...x, [a.id]: n }))}>★</button>)}
                </div>
                <input aria-label={j.note} placeholder={j.note} value={notes[a.id] ?? ""} maxLength={500} onChange={(e) => setNotes((x) => ({ ...x, [a.id]: e.target.value }))} />
              </div>
            )}
          </div>
          {done[a.id] ? <span className="badge ok" role="status">✓ {done[a.id]}</span> : (
            <div className="row" style={{ gap: 6 }}>
              <button className="btn sm ok" disabled={pending} onClick={() => act(a.id, "approved")}>{t.card.approve}</button>
              <button className="btn sm" disabled={pending} onClick={() => act(a.id, "changes")}>{t.card.change}</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function ServicesCard({ data, t, lang }: P & { data: Extract<Card, { type: "services" }>["data"] }) {
  return (
    <div className="grid g2">
      {data.map((s) => (
        <div className="tile" key={s.id}>
          <div className="row"><span className="ico">{s.icon}</span><b>{s.name}</b></div>
          <div className="small muted">{s.promise}</div>
          <div className="small">{t.page.services.month}: <b className="num">{fmtEur(s.month.eur, lang)}</b>{s.month.metrics.map((m) => <div key={m.metric} className="muted">{num(m.value, lang)} · {metricLabel(m.metric, lang)}</div>)}</div>
          <div className="small muted num">{fmtEur(s.monthlyEur, lang)} {t.card.perMonth} · {t.page.services.since.replace("{d}", s.since)}</div>
        </div>
      ))}
    </div>
  );
}

export function NextCard({ data, t, lang }: P & { data: Extract<Card, { type: "next" }>["data"] }) {
  const [sent, setSent] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="tile pcard">
      <div className="row"><span className="ico">{data.icon}</span><b>{data.name}</b></div>
      <div className="small">{data.outcome}</div>
      <div className="row small"><span className="muted">{t.card.from.replace("{eur}", fmtEur(data.fromEur, lang))}</span><span className="spacer" />
        {sent ? <span className="badge ok" role="status">✓ {sent}</span> : data.orderable
          ? <button className="btn sm primary" disabled={pending} onClick={() => start(async () => setSent((await orderPackage(data.product)).text))}>{t.card.order}</button>
          : <button className="btn sm primary" disabled={pending} onClick={() => start(async () => setSent((await sendRequest("upgrade", `${data.name} (${data.product})`)).text ?? "✓"))}>{t.card.tellUs}</button>}
      </div>
    </div>
  );
}

/** Projects in progress: milestones and how far along, never who does the work or what it costs us. */
export function ProjectsCard({ data, t, lang }: P & { data: Extract<Card, { type: "projects" }>["data"] }) {
  return (
    <div className="stack">
      {data.map((p) => (
        <div key={p.id} className="card pcard stack">
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}><b>{p.title}</b><span className="muted small">{p.code}</span><span className="spacer" /><span className="small muted">{t.card.readyBy} {p.dueAt}</span></div>
          <div className="progress" title={`${Math.round(p.progress * 100)}%`}><span style={{ width: `${Math.round(p.progress * 100)}%` }} /></div>
          <ul className="plist">{p.milestones.map((m) => <li key={m.title}><span>{m.title}{m.dueAt && m.status !== "accepted" && <span className="muted small"> · {journeyCopy(lang).due.replace("{d}", dayOf(m.dueAt, lang))}</span>}{m.rating ? <span className="muted small"> · {"★".repeat(m.rating)}</span> : null}</span><span className="spacer" /><span className={`badge ${m.status === "accepted" ? "ok" : m.status === "ready" || m.status === "unpaid" ? "warn" : "gray"}`}>{t.card.ms[m.status] ?? journeyCopy(lang).ms[m.status] ?? m.status}</span><b className="num">{fmtEur(m.amountEur, lang)}</b></li>)}</ul>
          {p.monthlyEur > 0 && <div className="muted small">{fmtEur(p.monthlyEur, lang)} {t.card.perMonth}</div>}
        </div>
      ))}
    </div>
  );
}

export function RequestsCard({ data, t, lang }: P & { data: Extract<Card, { type: "requests" }>["data"] }) {
  return (
    <div className="card pcard list">
      {data.map((r) => (
        <div className="item small" key={r.id}>
          <div className="grow"><span className="badge">{t.card.kinds[r.kind] ?? r.kind}</span> {r.text}{r.reply && <div className="callout small" style={{ marginTop: 6 }}>{r.reply}</div>}</div>
          <span className="muted">{r.priceBy ? `⏳ ${journeyCopy(lang).priceBy.replace("{d}", dayOf(r.priceBy, lang, true))}` : (t.card.status[r.status] ?? r.status)}</span>
        </div>
      ))}
    </div>
  );
}

function ConfirmCard({ card, t, onDone }: P & { card: Extract<Card, { type: "confirm" }>; onDone?: (text: string) => void }) {
  const [state, setState] = useState<"ask" | "sent" | "no">("ask");
  const [text, setText] = useState(card.text);
  const [pending, start] = useTransition();
  if (state === "no") return null;
  return (
    <div className="card pcard stack">
      <span className="badge" style={{ justifySelf: "start" }}>{t.card.kinds[card.kind] ?? card.kind}</span>
      {state === "sent" ? <span className="badge ok" role="status">✓ {t.r.sent}</span> : (
        <>
          <label className="sr-only" htmlFor={`req-${card.kind}`}>{t.page.requests.text}</label>
          <textarea id={`req-${card.kind}`} value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 64 }} />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm primary" disabled={pending || text.trim().length < 2} onClick={() => start(async () => { const r = await sendRequest(card.kind, text); if (r.ok) { setState("sent"); onDone?.(r.text!); } })}>{t.card.ask}</button>
            <button className="btn sm" onClick={() => setState("no")}>{t.card.cancel}</button>
          </div>
        </>
      )}
    </div>
  );
}

/** The scope the customer confirms with one press (marketplace lesson: Upwork Uma, Fiverr Dynamic Matching). */
function BriefCard({ data: b, lang, onDone }: P & { data: Extract<Card, { type: "brief" }>["data"]; onDone?: (text: string) => void }) {
  const j = journeyCopy(lang).brief;
  const [state, setState] = useState<"ask" | "no" | string>("ask");
  const [text, setText] = useState(b.problem);
  const [pending, start] = useTransition();
  if (state === "no") return null;
  return (
    <div className="card pcard stack">
      <b>📝 {j.title}</b>
      {state !== "ask" ? <span className="badge ok" role="status">✓ {state}</span> : (
        <>
          <label className="small muted" htmlFor="brief-problem">{j.problem}</label>
          <textarea id="brief-problem" value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 56 }} />
          <ul className="plist small">
            <li><span className="muted">{j.result}</span><span className="spacer" /><b>{b.package?.title ?? j.custom}</b></li>
            {b.package && <li><span className="muted">{j.steps}</span><span className="spacer" /><span>{b.package.steps.join(" → ")}</span></li>}
            {b.package && <li><span className="muted">⏱</span><span className="spacer" /><span>{j.days.replace("{n}", String(b.package.days))}</span></li>}
            {b.package && <li><span>✓ {j.included.replace("{n}", String(b.package.revisions))}</span></li>}
            <li><span className="muted">✗ {j.excluded}</span></li>
            <li><span className="muted">💶</span><span className="spacer" /><b>{b.package ? j.price.replace("{setup}", fmtEur(b.package.setupEur, lang)).replace("{monthly}", fmtEur(b.package.monthlyEur, lang)) : j.quoteBy.replace("{d}", dayOf(b.quoteBy!, lang, true))}</b></li>
            {b.package && <li><span className="muted small">{j.pay}</span></li>}
          </ul>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn sm primary" disabled={pending || text.trim().length < 3} onClick={() => start(async () => { const r = await confirmBrief(text); if (r.ok) { setState(r.text); onDone?.(r.text); } })}>{j.confirm}</button>
            <button className="btn sm" onClick={() => setState("no")}>{j.cancel}</button>
          </div>
        </>
      )}
    </div>
  );
}

/** "Not satisfied": the whole ladder is shown; one press starts the next step. */
function ComplaintCard({ data, lang, onDone }: P & { data: Extract<Card, { type: "complaint" }>["data"]; onDone?: (text: string) => void }) {
  const j = journeyCopy(lang).complaint;
  const [state, setState] = useState<string | null>(null);
  const [text, setText] = useState(data.text);
  const [pending, start] = useTransition();
  const at = ["fix", "swap", "founder"].indexOf(data.step);
  return (
    <div className="card pcard stack">
      <b>🤝 {j.title}</b>
      {data.step !== "support" && <ol className="small">{j.ladder.map((l, i) => <li key={l} className={i < at ? "muted" : undefined} style={{ fontWeight: i === at ? 700 : 400 }}>{l}</li>)}</ol>}
      {state ? <span className="badge ok" role="status">✓ {state}</span> : (
        <>
          <textarea aria-label={j.title} value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 56 }} />
          <div><button className="btn sm primary" disabled={pending || text.trim().length < 2} onClick={() => start(async () => { const r = await complainNow(text); if (r.ok) { setState(r.text); onDone?.(r.text); } })}>{j.go[data.step]}</button></div>
        </>
      )}
    </div>
  );
}

/** Leaving: which service, why (one press), and the date it ends. Nothing changes until "Give notice". */
function CancelCard({ data, lang, onDone }: P & { data: Extract<Card, { type: "cancel" }>["data"]; onDone?: (text: string) => void }) {
  const j = journeyCopy(lang).cancel;
  const [sub, setSub] = useState(data.subs[0]?.id ?? "");
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="card pcard stack">
      <b>{j.title}</b>
      {state ? <span className="badge ok" role="status">✓ {state}</span> : (
        <>
          {data.subs.length > 1 && <select aria-label={j.title} value={sub} onChange={(e) => setSub(e.target.value)}>{data.subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
          <div className="row" role="radiogroup" style={{ flexWrap: "wrap", gap: 6 }}>
            {Object.entries(j.reasons).map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={reason === id} className={`btn sm${reason === id ? " primary" : ""}`} onClick={() => setReason(id)}>{label}</button>)}
          </div>
          <textarea aria-label={j.note} placeholder={j.note} value={note} onChange={(e) => setNote(e.target.value)} style={{ minHeight: 48 }} />
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm" disabled={pending || !reason || !sub} onClick={() => start(async () => { const r = await cancelNow(sub, reason!, note); if (r.ok) { setState(r.text); onDone?.(r.text); } })}>{j.confirm}</button>
            <button className="btn sm primary" onClick={() => { setState(j.kept); onDone?.(j.kept); }}>{j.keep}</button>
          </div>
        </>
      )}
    </div>
  );
}

/** What we still need for each project; pressing one asks for it in the conversation. */
export function NeedsCard({ data, t, onSend }: P & { data: Extract<Card, { type: "needs" }>["data"]; onSend?: (text: string) => void }) {
  return (
    <div className="stack">
      {data.map((p) => (
        <div key={p.projectId} className="card pcard stack">
          <div className="row" style={{ flexWrap: "wrap", gap: 8 }}><b>{t.card.needs}</b><span className="muted small">{p.title} · {p.code}</span></div>
          <ul className="plist">{p.needs.map((n) => <li key={n.label}><span>{n.text}</span><span className="spacer" />{onSend && <button className="btn sm" onClick={() => onSend(`📎 ${n.text}`)}>{t.card.give}</button>}</li>)}</ul>
        </div>
      ))}
    </div>
  );
}

export function CardView({ card, t, lang, onDone, onSend }: P & { card: Card; onDone?: (text: string) => void; onSend?: (text: string) => void }) {
  switch (card.type) {
    case "results": return <ResultsCard data={card.data} t={t} lang={lang} />;
    case "goals": return <GoalsCard data={card.data} t={t} lang={lang} />;
    case "approvals": return <ApprovalsCard data={card.data} t={t} lang={lang} onDone={onDone} />;
    case "services": return <ServicesCard data={card.data} t={t} lang={lang} />;
    case "next": return <NextCard data={card.data} t={t} lang={lang} />;
    case "projects": return <ProjectsCard data={card.data} t={t} lang={lang} />;
    case "needs": return <NeedsCard data={card.data} t={t} lang={lang} onSend={onSend} />;
    case "requests": return <RequestsCard data={card.data} t={t} lang={lang} />;
    case "confirm": return <ConfirmCard card={card} t={t} lang={lang} onDone={onDone} />;
    case "brief": return <BriefCard data={card.data} t={t} lang={lang} onDone={onDone} />;
    case "complaint": return <ComplaintCard data={card.data} t={t} lang={lang} onDone={onDone} />;
    case "cancel": return <CancelCard data={card.data} t={t} lang={lang} onDone={onDone} />;
    case "link": return <Link className="btn sm" href={card.href}>{card.label} →</Link>;
  }
}
