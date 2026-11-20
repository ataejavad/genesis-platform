import { portalCopy } from "@/config/portal-copy";
import { getDb } from "@/db";
import { requireCustomer } from "@/lib/portal-auth";
import { listMembers } from "@/server/portal";
import { RequestForm } from "@/ui/portal/RequestForm";
import { PageHead } from "@/ui/Shell";

export default async function PortalSettings() {
  const { org, lang } = await requireCustomer();
  const t = portalCopy(lang);
  const s = t.page.settings;
  const members = await listMembers(getDb(), org.id);
  return (
    <main className="stack" style={{ maxWidth: 760 }}>
      <PageHead title={s.title} sub={s.sub} />
      <div className="card list">
        <h3>{s.members}</h3>
        {members.map((m) => <div className="item" key={m.id}><span className="avatar">{m.name.slice(0, 1)}</span><div className="grow">{m.name}<div className="muted small ltr">{m.email}</div></div><span className="badge">{s.roles[m.role] ?? m.role}</span></div>)}
      </div>
      <h3>{s.invite}</h3>
      <RequestForm t={t} kinds={["change"]} prefix={s.inviteText} />
    </main>
  );
}
