import { partnerCopy } from "@/config/partner-copy";
import { getDb } from "@/db";
import { requirePartner } from "@/lib/partner-auth";
import { messagesFor } from "@/server/partners";
import { MessageForm } from "@/ui/partner/DeliverForm";
import { PageHead } from "@/ui/Shell";

export default async function PartnerMessages() {
  const { partner, lang } = await requirePartner();
  const t = partnerCopy(lang);
  const p = t.page.messages;
  const msgs = await messagesFor(getDb(), partner.id);
  return (
    <main className="stack" style={{ maxWidth: 760 }}>
      <PageHead title={p.title} sub={p.sub} />
      <div className="plog card" style={{ minHeight: 0 }}>
        {msgs.map((m) => (
          <div key={m.id} className={`pturn ${m.author === "partner" ? "user" : "assistant"}`}>
            <div className={`msg ${m.author === "partner" ? "me" : "them"}`}><div className="who">{m.author === "partner" ? p.you : p.us}</div>{m.shown}{m.flagged && <div className="small" style={{ opacity: 0.8 }}>{p.hidden}</div>}</div>
          </div>
        ))}
      </div>
      <MessageForm t={t} />
    </main>
  );
}
