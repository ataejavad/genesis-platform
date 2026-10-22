import { count, eq, isNull, and, gte } from "drizzle-orm";
import ReactMarkdown from "react-markdown";
import { getDb } from "@/db";
import { contentItems, events } from "@/db/schema";
import { listPendingApprovals } from "@/server/content";
import { MAX_ATTEMPTS } from "@/worker/dispatch";
import { PageHead } from "@/ui/Shell";
import { decide } from "../actions";

export const dynamic = "force-dynamic";

export default async function Approvals() {
  const db = getDb();
  const [pending, [published], [stuck]] = await Promise.all([
    listPendingApprovals(db),
    db.select({ n: count() }).from(contentItems).where(eq(contentItems.status, "published")),
    db.select({ n: count() }).from(events).where(and(isNull(events.dispatchedAt), gte(events.attempts, MAX_ATTEMPTS))),
  ]);

  return (
    <main>
      <PageHead title="صف تأیید" crumbs="کابین" sub="هر چیزی که ایجنت‌ها یا همکاران پیشنهاد می‌دهند، قبل از انتشار از اینجا (یا تلگرام) تأیید می‌شود. این صفحه به پایگاه داده واقعی وصل است." />
      <section className="grid g3" style={{ marginBottom: 20 }}>
        <div className="card stat"><div className="label">منتظر تأیید</div><div className="value">{pending.length}</div></div>
        <div className="card stat"><div className="label">صفحه منتشرشده</div><div className="value">{published.n}</div></div>
        <div className="card stat"><div className="label">رویداد گیرکرده</div><div className="value" style={{ color: stuck.n ? "var(--bad)" : undefined }}>{stuck.n}</div></div>
      </section>
      {pending.length === 0 && <div className="card empty">چیزی منتظر تأیید نیست.</div>}
      {pending.map((a) => (
        <article key={a.id} className="card" style={{ marginBottom: 14 }}>
          <div className="card-head">
            <h3>{a.title}</h3>
            <span className="badge">{a.liveStatus === "published" ? "ویرایش صفحه زنده" : "صفحه تازه"}</span>
          </div>
          <p className="muted small ltr" style={{ textAlign: "right" }}>
            /{a.locale}/{a.slug} · v{a.subjectVersion} · {a.requestedBy} · {a.createdAt.toISOString().slice(0, 16).replace("T", " ")}
          </p>
          <div dir="auto" style={{ maxHeight: 300, overflow: "auto", borderTop: "1px solid var(--line)", paddingTop: 8 }}>
            <ReactMarkdown>{a.body}</ReactMarkdown>
          </div>
          <form action={decide} className="row" style={{ marginTop: 12 }}>
            <input type="hidden" name="id" value={a.id} />
            <input name="note" placeholder="یادداشت (اختیاری)" style={{ flex: 1, minWidth: 180 }} />
            <button className="btn ok" name="decision" value="approved">تأیید و انتشار</button>
            <button className="btn danger" name="decision" value="rejected">رد</button>
          </form>
        </article>
      ))}
    </main>
  );
}
