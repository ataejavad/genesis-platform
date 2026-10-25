import { portalCopy } from "@/config/portal-copy";
import { getDb } from "@/db";
import { requireCustomer } from "@/lib/portal-auth";
import { BRAND } from "@/mock/data";
import { listRequests, pendingApprovals } from "@/server/portal";
import { PortalShell } from "@/ui/portal/PortalShell";

export const dynamic = "force-dynamic";

// Customer dashboard (doc 15 §6و): home is the conversation, the rest are pages on the customer's own data.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, org, lang, viewingAs } = await requireCustomer();
  const db = getDb();
  const [waiting, requests] = await Promise.all([pendingApprovals(db, org.id), listRequests(db, org.id)]);
  return (
    <PortalShell t={portalCopy(lang)} lang={lang} brand={BRAND} company={org.name} user={user.name} viewingAs={viewingAs}
      counts={{ home: waiting.length, requests: requests.filter((r) => r.status !== "done").length }}>
      {children}
    </PortalShell>
  );
}
