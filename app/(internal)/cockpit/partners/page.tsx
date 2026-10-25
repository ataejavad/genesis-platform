import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { organizations, partnerDocuments, partners } from "@/db/schema";
import { SKILLS, skillLabel } from "@/server/partner-rules";
import { duePayouts, listJobs, listPartners, matchesFor, partnerInbox, pendingDeliveries } from "@/server/partners";
import { PageHead } from "@/ui/Shell";
import { openGaps } from "@/server/supply";
import { closeGapNow, doc, invite, offer, paid, reply } from "./actions";
import { DecideForm, JobForm, KeyForm } from "./Forms";

const eur = (n: number) => `€${n.toLocaleString("en-GB")}`;
const day = (d: Date) => d.toISOString().slice(0, 10);

// Step 6: the team side of the partner portal. Applications, documents, jobs and matching, delivery review,
// payouts and messages. Agent partners use /api/v1/partner/* with a partner:work key.
export default async function CockpitPartners() {
  const db = getDb();
  const [all, jobRows, toReview, payoutsDue, inbox, docs, customers, gaps] = await Promise.all([
    listPartners(db), listJobs(db), pendingDeliveries(db), duePayouts(db), partnerInbox(db),
    db.select({ doc: partnerDocuments, partner: partners.name }).from(partnerDocuments).innerJoin(partners, eq(partners.id, partnerDocuments.partnerId)).where(eq(partnerDocuments.status, "pending")),
    db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(eq(organizations.kind, "customer")),
    openGaps(db),
  ]);
  const applied = all.filter((x) => x.partner.status === "applied");
  const open = jobRows.filter((j) => ["open", "offered"].includes(j.job.status));
  const preview = await Promise.all(open.map(async (j) => ({ id: j.job.id, top: (await matchesFor(db, j.job.id)).slice(0, 3) })));
  return (
    <main className="stack">
      <PageHead title="Partners" crumbs="Cockpit › Delivery" sub="Everyone who works for or through us. Every automated match shows its reasons; partners can ask for a human review." />

      <div className="card" id="gaps">
        <h3>Skills we lack ({gaps.length})</h3>
        <p className="muted small">Opened by the watchdog when a job finds no partner. Post the text (LinkedIn, job boards, communities), decide pending applicants, invite earlier ones back. A partner with the skill starting closes it.</p>
        {gaps.length === 0 && <p className="muted">None.</p>}
        <div className="list">
          {gaps.map(({ gap: g, candidates }) => (
            <div key={g.id} className="item" style={{ alignItems: "start", flexWrap: "wrap" }}>
              <div className="grow"><b>{skillLabel(g.skill, "en")}</b> <span className="muted small">{[g.language, g.country].filter(Boolean).join(" · ")} · since {g.createdAt.toISOString().slice(0, 10)}</span>
                <pre className="small" style={{ whiteSpace: "pre-wrap", margin: "4px 0" }}>{g.post}</pre>
                <div className="small">{candidates.length ? <>Earlier applicants: {candidates.map((c) => `${c.name} (${c.status})`).join(", ")}</> : <span className="muted">No earlier applicants with this skill.</span>}</div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {candidates.some((c) => c.status === "rejected") && <form action={invite}><input type="hidden" name="id" value={g.id} /><button className="btn sm primary" disabled={Boolean(g.invitedAt)}>{g.invitedAt ? "Invited" : "Invite back"}</button></form>}
                <form action={closeGapNow}><input type="hidden" name="id" value={g.id} /><button className="btn sm">Close</button></form>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Applications ({applied.length})</h3>
        {applied.length === 0 && <p className="muted">None waiting.</p>}
        <div className="list">
          {applied.map(({ partner: p }) => (
            <div key={p.id} className="item" style={{ alignItems: "start", flexWrap: "wrap" }}>
              <div className="grow"><b>{p.name}</b> <span className="muted small">{p.kind} · {p.country} · {p.languages.join("/")} · {p.email}</span>
                <div className="small">{p.skills.map((s) => skillLabel(s, "en")).join(", ")}</div>
                {p.pitch && <div className="small muted">“{p.pitch.slice(0, 300)}”</div>}
                <div className="small">{p.links.map((l) => <a key={l} href={l} target="_blank" rel="noopener noreferrer" style={{ marginInlineEnd: 8 }}>{l.slice(0, 50)}</a>)}</div>
                {p.screening && <div className="small"><span className="badge ai">Screening {p.screening.score}</span> {p.screening.why.join(" · ")}</div>}
              </div>
              <DecideForm id={p.id} email={p.email} />
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>Deliveries to review ({toReview.length})</h3>
        <p className="small" style={{ margin: 0 }}>{toReview.length ? <>Checked per criterion in the <Link href="/cockpit/qa">QA queue</Link>.</> : "None."}</p>
      </div>

      <div className="card table-wrap">
        <h3>Jobs</h3>
        <table>
          <thead><tr><th>Job</th><th>For</th><th>Status</th><th>Partner</th><th>Pay</th><th>Margin</th><th>Due</th><th>Top matches (fit)</th><th></th></tr></thead>
          <tbody>
            {jobRows.map(({ job: j, partner }) => {
              const top = preview.find((x) => x.id === j.id)?.top ?? [];
              return (
                <tr key={j.id}>
                  <td>{j.title}</td><td className="small">{j.customerCode ?? "internal"}</td><td><span className="badge">{j.status}</span></td><td>{partner ?? "–"}</td>
                  <td>{eur(j.payEur)}</td><td>{j.priceEur ? eur(j.priceEur - j.payEur) : "–"}</td><td>{day(j.dueAt)}</td>
                  <td className="small">{top.map((m) => `${m.partner.name} (${m.fit})`).join(", ") || (["open", "offered"].includes(j.status) ? "no eligible partner" : "")}</td>
                  <td>{["open", "offered"].includes(j.status) && <form action={offer}><input type="hidden" name="job" value={j.id} /><button className="btn sm primary">Offer to best matches</button></form>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <JobForm skills={SKILLS.map((s) => ({ id: s.id, label: s.label.en }))} customers={customers} />

      <div className="grid g2">
        <div className="card">
          <h3>Payouts due ({payoutsDue.length})</h3>
          <div className="list">
            {payoutsDue.map(({ payout: p, partner, title }) => (
              <form key={p.id} action={paid} className="item small"><input type="hidden" name="payout" value={p.id} /><div className="grow">{partner} · {title} · due {day(p.dueAt)}</div><b>{eur(p.amountEur)}</b><button className="btn sm">Mark paid</button></form>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Documents to check ({docs.length})</h3>
          <div className="list">
            {docs.map(({ doc: d, partner }) => (
              <form key={d.id} action={doc} className="item small"><input type="hidden" name="doc" value={d.id} /><div className="grow">{partner} · {d.kind} · <a href={d.link} target="_blank" rel="noopener noreferrer">open</a>{d.expiresAt && ` · expires ${day(d.expiresAt)}`}</div><button className="btn sm ok" name="ok" value="yes">OK</button><button className="btn sm" name="ok" value="no">Reject</button></form>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Messages (30 days)</h3>
        <div className="list">
          {inbox.map(({ message: m, partner }) => (
            <div key={m.id} className="item small" style={{ flexWrap: "wrap" }}>
              <div className="grow"><b>{m.author === "us" ? `→ ${partner}` : partner}</b> {m.reviewRequest && <span className="badge warn">human review asked</span>} {m.flagged && <span className="badge warn">contact details hidden</span>}<div>{m.author === "us" ? m.body : m.shown}</div></div>
              {m.author === "partner" && <form action={reply} className="row" style={{ gap: 6, flexBasis: "100%" }}><input type="hidden" name="partner" value={m.partnerId} /><input name="body" placeholder="Reply" required /><button className="btn sm">Send</button></form>}
            </div>
          ))}
        </div>
      </div>

      <div className="card table-wrap">
        <h3>Partners ({all.length - applied.length})</h3>
        <table>
          <thead><tr><th>Name</th><th>Kind</th><th>Country</th><th>Skills</th><th>Status</th><th>Level</th><th>Accepted</th><th>Quality</th><th>On time</th><th>Capacity</th><th>API</th></tr></thead>
          <tbody>{all.filter((x) => x.partner.status !== "applied").map(({ partner: p, level: l }) => <tr key={p.id}><td>{p.name}</td><td>{p.kind}</td><td>{p.country}</td><td className="small">{p.skills.join(", ")}</td><td>{p.status}</td><td>{l.tier.id}</td><td>{l.stats.accepted}</td><td>{l.stats.avgQuality ?? "–"}</td><td>{l.stats.onTimeRate === null ? "–" : `${Math.round(l.stats.onTimeRate * 100)}%`}</td><td>{p.capacity}</td><td>{p.status !== "rejected" && <KeyForm id={p.id} has={Boolean(p.apiKeyId)} />}</td></tr>)}</tbody>
        </table>
      </div>
    </main>
  );
}
