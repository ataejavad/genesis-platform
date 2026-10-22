import { count, eq, isNull, and, gte } from "drizzle-orm";
import ReactMarkdown from "react-markdown";
import { getDb } from "@/db";
import { contentItems, events } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { listPendingApprovals } from "@/server/content";
import { MAX_ATTEMPTS } from "@/worker/dispatch";
import { decide } from "./actions";

export const dynamic = "force-dynamic";

export default async function Cockpit() {
  const user = await requireAdmin();
  const db = getDb();
  const [pending, [published], [stuck]] = await Promise.all([
    listPendingApprovals(db),
    db.select({ n: count() }).from(contentItems).where(eq(contentItems.status, "published")),
    db.select({ n: count() }).from(events).where(and(isNull(events.dispatchedAt), gte(events.attempts, MAX_ATTEMPTS))),
  ]);

  return (
    <main>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>کابین</h1>
        <span className="muted">{user.name}</span>
      </div>

      <section className="stats">
        <div className="card stat"><b>{pending.length}</b>منتظر تأیید</div>
        <div className="card stat"><b>{published.n}</b>صفحه منتشرشده</div>
        <div className="card stat"><b style={{ color: stuck.n ? "var(--bad)" : undefined }}>{stuck.n}</b>رویداد گیرکرده</div>
      </section>

      <h2>صف تأیید</h2>
      {pending.length === 0 && <p className="muted">چیزی منتظر تأیید نیست.</p>}
      {pending.map((a) => (
        <article key={a.id} className="card">
          <h3 style={{ marginTop: 0 }}>{a.title}</h3>
          <p className="muted" dir="ltr" style={{ textAlign: "right" }}>
            /{a.locale}/{a.slug} · v{a.subjectVersion} · {a.requestedBy} · {a.createdAt.toISOString().slice(0, 16).replace("T", " ")}
            {a.liveStatus === "published" ? " · ویرایش صفحه زنده" : " · صفحه تازه"}
          </p>
          <div className="preview" dir="auto">
            <ReactMarkdown>{a.body}</ReactMarkdown>
          </div>
          <form action={decide} className="row" style={{ marginTop: 12 }}>
            <input type="hidden" name="id" value={a.id} />
            <input name="note" placeholder="یادداشت (اختیاری)" style={{ flex: 1, minWidth: 180 }} />
            <button className="ok" name="decision" value="approved">تأیید و انتشار</button>
            <button className="bad" name="decision" value="rejected">رد</button>
          </form>
        </article>
      ))}
    </main>
  );
}
