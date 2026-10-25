import { count, eq, isNull, and, gte } from "drizzle-orm";
import ReactMarkdown from "react-markdown";
import { getDb } from "@/db";
import { contentItems, events } from "@/db/schema";
import { listPendingApprovals } from "@/server/content";
import { parseHubDoc } from "@/server/hubs";
import { copyFor } from "@/config/site-copy";
import { BRAND } from "@/mock/data";
import { HubView } from "@/ui/site/HubView";
import { MAX_ATTEMPTS } from "@/worker/dispatch";
import { PageHead } from "@/ui/Shell";
import { decide } from "../actions";
import Link from "next/link";
import { needsYou } from "@/server/needs-you";

export const dynamic = "force-dynamic";

export default async function Approvals() {
  const db = getDb();
  const [needs, pending, [published], [stuck]] = await Promise.all([
    needsYou(db),
    listPendingApprovals(db),
    db.select({ n: count() }).from(contentItems).where(eq(contentItems.status, "published")),
    db.select({ n: count() }).from(events).where(and(isNull(events.dispatchedAt), gte(events.attempts, MAX_ATTEMPTS))),
  ]);

  return (
    <main>
      <PageHead title="Needs you" crumbs="Cockpit" sub="One inbox: everything any module waits on you for, most urgent first. Low-risk work runs on its own; high risk and the hard limits come here (or Telegram)." />
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><h3>✋ Everything waiting for you</h3><span className="badge ok">live</span></div>
        <div className="list">{needs.map((x) => <div key={x.id} className="item"><span className="badge warn num">{x.n}</span><div className="grow small"><b>{x.label}</b><div className="muted">{x.why}</div></div><Link className="btn sm" href={x.link}>Open</Link></div>)}
          {!needs.length && <div className="muted small">Nothing waits for you.</div>}</div>
      </div>
      <h2 id="content">Website content</h2>
      <section className="grid g3" style={{ marginBottom: 20 }}>
        <div className="card stat"><div className="label">Waiting</div><div className="value">{pending.length}</div></div>
        <div className="card stat"><div className="label">Published pages</div><div className="value">{published.n}</div></div>
        <div className="card stat"><div className="label">Stuck events</div><div className="value" style={{ color: stuck.n ? "var(--bad)" : undefined }}>{stuck.n}</div></div>
      </section>
      {pending.length === 0 && <div className="card empty">Nothing is waiting for approval.</div>}
      {pending.map((a) => (
        <article key={a.id} className="card" style={{ marginBottom: 14 }}>
          <div className="card-head">
            <h3>{a.title}</h3>
            <span className="badge">{a.liveStatus === "published" ? "Edit of live page" : "New page"}</span>
          </div>
          <p className="muted small ltr" style={{ textAlign: "left" }}>
            /{a.locale}/{a.slug} · v{a.subjectVersion} · {a.requestedBy} · {a.createdAt.toISOString().slice(0, 16).replace("T", " ")}
          </p>
          <BodyPreview body={a.body} locale={a.locale} />
          <form action={decide} className="row" style={{ marginTop: 12 }}>
            <input type="hidden" name="id" value={a.id} />
            <input name="note" placeholder="Note (optional)" style={{ flex: 1, minWidth: 180 }} />
            <button className="btn ok" name="decision" value="approved">Approve & publish</button>
            <button className="btn danger" name="decision" value="rejected">Reject</button>
          </form>
        </article>
      ))}
    </main>
  );
}

// Hub pages are JSON from the hub-builder agent: show them as the visitor will see them, sources included.
function BodyPreview({ body, locale }: { body: string; locale: string }) {
  const hub = parseHubDoc(body);
  const box = { maxHeight: hub ? 520 : 300, overflow: "auto", borderTop: "1px solid var(--line)", paddingTop: 8 } as const;
  if (!hub) return <div dir="auto" style={box}><ReactMarkdown>{body}</ReactMarkdown></div>;
  const official = [...hub.deadlines, hub.overview].flatMap((x) => x.sources).filter((s) => s.kind === "official").length;
  return (
    <>
      <p className="small">
        Industry hub · {hub.deadlines.length} deadlines · {hub.news.length} news · {hub.pains.length} pains · {official} official sources ·
        hook <b>{hub.hook.id}</b> · KPI: {hub.kpi.name} (target {hub.kpi.target}/month)
      </p>
      <div dir={locale.startsWith("fa") ? "rtl" : "ltr"} lang={locale.slice(0, 2)} style={box}>
        <HubView doc={hub} c={copyFor(locale)} locale={locale} brand={BRAND} country={null} preview />
      </div>
    </>
  );
}
