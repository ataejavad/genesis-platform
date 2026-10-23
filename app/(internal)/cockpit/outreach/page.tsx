import Link from "next/link";
import { linkedinSearch } from "@/agents/decision-maker";
import { getDb } from "@/db";
import { outreachQueue, priority } from "@/server/crm";
import { mailerFromEnv } from "@/server/mailer";
import { OUTCOMES, allSwitches } from "@/server/outreach";
import { COUNTRY_RULES, SWITCHES } from "@/server/outreach-rules";
import { voiceFromEnv } from "@/server/voice";
import { whatsappFromEnv } from "@/server/whatsapp";
import { PageHead } from "@/ui/Shell";
import { approve, done, edit, reject, rpo, toggle } from "./actions";

export const dynamic = "force-dynamic";

const CH: Record<string, string> = { linkedin: "💼 LinkedIn", email: "✉️ Email", phone: "📞 Call" };
const RISK: Record<string, string> = { low: "ok", medium: "warn", high: "bad" };
const LABEL: Record<string, string> = { "email-cold": "Cold email", "voice-ai": "AI voice calls", "call-warm": "Warm call after reply / page visit" };

/** Outbound queue (step 4): approve first messages, do today's LinkedIn and phone tasks, switch channels. */
export default async function Outreach() {
  const db = getDb();
  const now = new Date();
  const [q, switches] = await Promise.all([outreachQueue(db, now), allSwitches(db)]);
  const on = (cc: string, ch: string) => switches.some((s) => s.country === cc && s.channel === ch && s.enabled);
  const mailer = mailerFromEnv();
  const voice = voiceFromEnv();
  const wa = whatsappFromEnv();
  const parked = q.emails.filter((e) => e.t.blockedReason);
  return (
    <main>
      <PageHead title="Outbound" crumbs="Cockpit › Growth" sub="AI finds and writes; you approve the first message of each company; LinkedIn and calls are done by a person. Replies stop a sequence at once." />

      <section className="grid g4" style={{ marginBottom: 18 }}>
        <div className="card stat"><div className="label">Waiting for your approval</div><div className="value num">{q.approvals.length}</div><div className="delta muted">companies</div></div>
        <div className="card stat"><div className="label">Tasks due now</div><div className="value num">{q.tasks.length}</div><div className="delta muted">LinkedIn {q.linkedin.invitesLeft} invites / {q.linkedin.messagesLeft} messages left today{q.linkedin.held ? ` · ${q.linkedin.held} held for tomorrow` : ""}</div></div>
        <div className="card stat"><div className="label">Emails due</div><div className="value num">{q.emails.length}</div><div className="delta muted">{mailer ? `sending via ${mailer.provider}` : "no email provider yet (Brevo key)"}{parked.length ? ` · ${parked.length} parked` : ""}</div></div>
        <div className="card stat"><div className="label">Connections</div><div className="small">AI caller: <b>{voice ? voice.provider : "off"}</b><br />WhatsApp agent: <b>{wa ? "on" : "off"}</b></div></div>
      </section>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-head"><h3>Channel switches</h3><span className="more muted small">Off by default. When on, each contact still needs a recorded legal basis (CRM › contact).</span></div>
        <table className="table"><thead><tr><th>Country</th><th>Channel</th><th>Risk</th><th>Why</th><th /></tr></thead>
          <tbody>{Object.keys(COUNTRY_RULES).flatMap((cc) => SWITCHES.map((ch) => {
            const r = COUNTRY_RULES[cc][ch];
            const isOn = on(cc, ch);
            return (
              <tr key={cc + ch}><td>{cc}</td><td>{LABEL[ch]}</td><td><span className={`badge ${RISK[r.risk]}`}>{r.risk}</span></td><td className="small">{r.why}</td>
                <td><form action={toggle}><input type="hidden" name="country" value={cc} /><input type="hidden" name="channel" value={ch} />{isOn ? <button className="btn sm">On · switch off</button> : <><input type="hidden" name="enabled" value="on" /><button className="btn sm primary">Switch on</button></>}</form></td></tr>
            );
          }))}</tbody></table>
      </div>

      <h2>Approve first messages</h2>
      {q.approvals.length === 0 && <div className="card empty small">Nothing waiting. New companies arrive from the company agent (npm run agents:outbound) or the check-up.</div>}
      {q.approvals.map(({ p, touches }) => {
        const pr = priority(p, now);
        return (
          <div key={p.id} className="card" style={{ marginBottom: 14 }}>
            <div className="card-head">
              <h3><Link href={`/cockpit/crm/${p.id}`}>{p.name}</Link> <span className="muted small">{p.city ?? ""} · {p.industry} · {p.source}</span></h3>
              <span className={`badge ${pr.tier === 1 ? "ok" : ""}`}>Tier {pr.tier}{pr.tier === 1 ? " · act within 48h" : ""}</span>
              <span className="more row" style={{ gap: 8 }}>
                <form action={approve}><input type="hidden" name="prospect" value={p.id} /><button className="btn sm primary">Approve sequence</button></form>
                <form action={reject}><input type="hidden" name="prospect" value={p.id} /><button className="btn sm">Reject</button></form>
              </span>
            </div>
            <div className="list">
              {touches.map(({ t }) => (
                <details key={t.id} className="item" style={{ display: "block" }} open={t.position === 0}>
                  <summary><b>{CH[t.channel]}</b> {t.step} {t.blockedReason && <span className="badge warn">{t.blockedReason}</span>}</summary>
                  <div className="grid g2" style={{ gap: 12, marginTop: 8 }}>
                    <form action={edit} className="stack" style={{ gap: 6 }}>
                      <input type="hidden" name="touch" value={t.id} />
                      {t.subject !== null && <input name="subject" defaultValue={t.subject} />}
                      <textarea name="body" defaultValue={t.body} rows={7} />
                      <button className="btn sm">Save text</button>
                    </form>
                    <div className="small" dir="rtl" style={{ whiteSpace: "pre-wrap" }}>{t.bodyFa}</div>
                  </div>
                </details>
              ))}
            </div>
          </div>
        );
      })}

      <h2>Do now</h2>
      {q.tasks.length === 0 && <div className="card empty small">No LinkedIn or phone tasks due.</div>}
      <div className="list">
        {q.tasks.map(({ t, p, c, why }) => (
          <div key={t.id} className="card" style={{ marginBottom: 10 }}>
            <div className="card-head">
              <h3>{CH[t.channel]} · <Link href={`/cockpit/crm/${p.id}`}>{p.name}</Link></h3>
              <span className="muted small">{c?.name ?? c?.role ?? ""} {t.channel === "phone" && (c?.phone ?? p.phone)}</span>
              {t.channel === "linkedin" && <a className="btn sm more" href={c?.linkedinUrl ?? linkedinSearch(p.name, c?.role ?? undefined)} target="_blank" rel="noopener">Open LinkedIn ↗</a>}
            </div>
            <pre className="small" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{t.body}</pre>
            {why && (
              <div className="callout small">
                ⚠️ {why}
                {why.includes("Registro") && (
                  <span className="row" style={{ gap: 6, marginTop: 6 }}>
                    <form action={rpo}><input type="hidden" name="prospect" value={p.id} /><input type="hidden" name="listed" value="no" /><button className="btn sm primary">Checked: not in the Registro</button></form>
                    <form action={rpo}><input type="hidden" name="prospect" value={p.id} /><input type="hidden" name="listed" value="yes" /><button className="btn sm">Listed: do not call</button></form>
                  </span>
                )}
              </div>
            )}
            <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              {(OUTCOMES[t.channel as keyof typeof OUTCOMES] ?? []).map((o) => (
                <form key={o} action={done}><input type="hidden" name="touch" value={t.id} /><input type="hidden" name="outcome" value={o} /><button className="btn sm" disabled={Boolean(why)}>{o.replace("_", " ")}</button></form>
              ))}
            </div>
          </div>
        ))}
      </div>

      {parked.length > 0 && (
        <>
          <h2>Emails parked</h2>
          <table className="table card"><tbody>{parked.map(({ t, p }) => <tr key={t.id}><td><Link href={`/cockpit/crm/${p.id}`}>{p.name}</Link></td><td>{t.step}</td><td className="small">{t.blockedReason}</td></tr>)}</tbody></table>
        </>
      )}
    </main>
  );
}
