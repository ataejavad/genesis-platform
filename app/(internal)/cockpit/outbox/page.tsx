import { getDb } from "@/db";
import { mailerFromEnv } from "@/server/mailer";
import { outbox } from "@/server/notify";
import { PageHead } from "@/ui/Shell";

// Every message to customers, partners and leads (notification layer). Without an email key they wait here.
export default async function Outbox() {
  const rows = await outbox(getDb(), 200);
  const mailer = mailerFromEnv();
  const queued = rows.filter((r) => r.status === "queued").length;
  return (
    <main>
      <PageHead title="Outbox" crumbs="Cockpit › Money & legal" sub="Messages created from events in each person's language: invites, contracts, payment requests, reminders, offers, payouts, lead confirmations." />
      <div className="callout small" style={{ marginBottom: 18 }}>
        {mailer ? `Sending through ${mailer.provider}. ${queued} waiting.` : `No email key set: ${queued} message(s) waiting. Add the Brevo key in .env on the server (not in chat) and they go out by themselves. Until then forward invites by hand.`}
      </div>
      <div className="card list">
        {rows.map((n) => (
          <details className="item small" key={n.id} style={{ display: "block" }}>
            <summary className="row" style={{ cursor: "pointer" }}>
              <span className={`badge ${n.status === "sent" ? "ok" : n.status === "failed" ? "warn" : ""}`}>{n.status}</span>
              <span className="badge gray">{n.audience}</span>
              <b className="grow" style={{ flex: 1 }}>{n.subject}</b>
              <span className="muted ltr">{n.email}</span>
              <span className="muted">{n.createdAt.toISOString().slice(0, 16).replace("T", " ")}</span>
            </summary>
            {/* signing codes stay with the signer: showing them here would let anyone with cockpit access sign */}
            <pre style={{ whiteSpace: "pre-wrap", font: "inherit", margin: "8px 0 0" }}>{n.template === "code" ? "(one-time signing code hidden)" : n.body}</pre>
            {n.error && <div style={{ color: "var(--bad)" }}>{n.error}</div>}
          </details>
        ))}
        {!rows.length && <p className="empty">Nothing yet.</p>}
      </div>
    </main>
  );
}
