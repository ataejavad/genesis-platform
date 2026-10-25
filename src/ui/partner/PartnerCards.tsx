"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { PartnerCopy } from "@/config/partner-copy";
import { fmtEur, fmtNum } from "@/config/portal-copy";
import type { OfferCardData, PartnerCard } from "@/server/partner-chat";
import { messageTeam, respond } from "./actions";

type P = { t: PartnerCopy; lang: string };

/** One job offer with its match score and every reason behind it (algorithmic transparency). */
export function OfferCard({ o, t, lang, onDone }: P & { o: OfferCardData; onDone?: (text: string) => void }) {
  const [state, setState] = useState<string | null>(null);
  const [asked, setAsked] = useState(false);
  const [pending, start] = useTransition();
  const c = t.card;
  const act = (accept: boolean) => start(async () => { const r = await respond(o.id, accept); setState(r.text); onDone?.(r.text); });
  return (
    <div className="card pcard stack">
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        <b>{o.title}</b><span className="badge">{o.kind === "customer" ? `${c.customer} ${o.customerCode ?? ""}` : c.internal}</span>
        <span className="spacer" /><span className="badge ok">{c.fit.replace("{fit}", String(o.fit))}</span>
      </div>
      <div className="small">{o.brief}</div>
      <div className="row small" style={{ gap: 16 }}><span>{c.pay}: <b className="num">{fmtEur(o.payEur, lang)}</b></span><span>{c.due}: <b>{o.dueAt}</b></span></div>
      <details className="small">
        <summary>{c.why}</summary>
        <ul className="plist">
          {o.why.map((w) => <li key={w.factor}><span>{c.factors[w.factor] ?? w.factor}</span><span className="spacer" /><b className="num">{w.points}/{w.max}</b></li>)}
        </ul>
        <ul>{o.checklist.map((x) => <li key={x}>{x}</li>)}</ul>
      </details>
      {state ? <span className="badge ok" role="status">✓ {state}</span> : (
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <button className="btn sm ok" disabled={pending} onClick={() => act(true)}>{c.accept}</button>
          <button className="btn sm" disabled={pending} onClick={() => act(false)}>{c.decline}</button>
          {asked ? <span className="badge" role="status">✓ {t.r.sent}</span> : <button className="btn sm" disabled={pending} onClick={() => start(async () => { await messageTeam(`${c.reviewText}${o.title} (${c.fit.replace("{fit}", String(o.fit))})`, true); setAsked(true); })}>{c.reviewAsk}</button>}
        </div>
      )}
    </div>
  );
}

export function LevelCard({ data: l, t, lang }: P & { data: Extract<PartnerCard, { type: "level" }>["data"] }) {
  const p = t.page.level;
  const fmt = (what: string, v: number) => (what === "onTime" ? `${Math.round(v * 100)}%` : fmtNum(v, lang));
  return (
    <div className="card pcard stack">
      <div className="row" style={{ gap: 24, flexWrap: "wrap" }}>
        <div><div className="muted small">{t.nav.level}</div><div className="big">{t.tiers[l.tier.id]}</div><div className="muted small">{t.card.perDays.replace("{d}", String(l.tier.payoutDays))}</div></div>
        <div><div className="muted small">{p.accepted}</div><div className="mid num">{l.stats.accepted}</div></div>
        <div><div className="muted small">{p.quality}</div><div className="mid num">{l.stats.avgQuality === null ? "–" : `${fmtNum(l.stats.avgQuality, lang)}/5`}</div></div>
        <div><div className="muted small">{p.onTime}</div><div className="mid num">{l.stats.onTimeRate === null ? "–" : `${Math.round(l.stats.onTimeRate * 100)}%`}</div></div>
      </div>
      {l.next && (
        <div className="small">
          <b>{p.next.replace("{tier}", t.tiers[l.next.id])}</b>
          <ul>{l.missing.map((m) => <li key={m.what}>{fmt(m.what, m.need)} {t.missing[m.what]} · <span className="muted">{p.have.replace("{have}", fmt(m.what, m.have))}</span></li>)}</ul>
        </div>
      )}
    </div>
  );
}

export function EarningsCard({ data: e, t, lang }: P & { data: Extract<PartnerCard, { type: "earnings" }>["data"] }) {
  const p = t.page.earnings;
  return (
    <div className="card pcard">
      <div className="row" style={{ gap: 24, flexWrap: "wrap" }}>
        <div><div className="muted small">{p.month}</div><div className="big num">{fmtEur(e.monthEur, lang)}</div></div>
        <div><div className="muted small">{p.due}</div><div className="mid num">{fmtEur(e.dueEur, lang)}</div></div>
        <div><div className="muted small">{p.paid}</div><div className="mid num">{fmtEur(e.paidEur, lang)}</div></div>
      </div>
      {e.rows.length > 0 && (
        <ul className="plist">{e.rows.slice(0, 8).map((r) => <li key={r.id}><span>{r.title}</span><span className="spacer" /><span className="muted small">{t.status[r.status] ?? r.status} · {r.paidAt ?? r.dueAt}</span><b className="num">{fmtEur(r.amountEur, lang)}</b></li>)}</ul>
      )}
    </div>
  );
}

function ConfirmCard({ text, t, onDone }: P & { text: string; onDone?: (text: string) => void }) {
  const [value, setValue] = useState(text);
  const [state, setState] = useState<"ask" | "sent" | "no">("ask");
  const [pending, start] = useTransition();
  if (state === "no") return null;
  return state === "sent" ? <span className="badge ok" role="status">✓ {t.r.sent}</span> : (
    <div className="card pcard stack">
      <label className="sr-only" htmlFor="partner-help">{t.page.messages.write}</label>
      <textarea id="partner-help" value={value} onChange={(e) => setValue(e.target.value)} style={{ minHeight: 64 }} />
      <div className="row" style={{ gap: 8 }}>
        <button className="btn sm primary" disabled={pending || value.trim().length < 2} onClick={() => start(async () => { const r = await messageTeam(value); setState("sent"); onDone?.(r.text); })}>{t.card.ask}</button>
        <button className="btn sm" onClick={() => setState("no")}>{t.card.cancel}</button>
      </div>
    </div>
  );
}

export function PartnerCardView({ card, t, lang, onDone }: P & { card: PartnerCard; onDone?: (text: string) => void }) {
  switch (card.type) {
    case "offers": return <div className="stack">{card.data.map((o) => <OfferCard key={o.id} o={o} t={t} lang={lang} onDone={onDone} />)}</div>;
    case "next": return <Link className="tile" href="/partner/work"><b>{card.data.title}</b><span className="small">{t.card.due}: {card.data.dueAt} · {t.status[card.data.status] ?? card.data.status}</span></Link>;
    case "earnings": return <EarningsCard data={card.data} t={t} lang={lang} />;
    case "level": return <LevelCard data={card.data} t={t} lang={lang} />;
    case "confirm": return <ConfirmCard text={card.text} t={t} lang={lang} onDone={onDone} />;
  }
}

