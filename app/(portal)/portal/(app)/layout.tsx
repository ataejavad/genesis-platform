import { portalCopy } from "@/config/portal-copy";
import { getDb } from "@/db";
import { requireCustomer } from "@/lib/portal-auth";
import { BRAND } from "@/mock/data";
import { listRequests, pendingApprovals } from "@/server/portal";
import { setLanguage } from "@/ui/portal/actions";
import { AppShell } from "@/ui/portal/AppShell";

export const dynamic = "force-dynamic";

// Customer dashboard (doc 15 §6و): home is the conversation, the rest are pages on the customer's own data.
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, org, lang, viewingAs } = await requireCustomer();
  const db = getDb();
  const t = portalCopy(lang);
  const [waiting, requests] = await Promise.all([pendingApprovals(db, org.id), listRequests(db, org.id)]);
  const nav = [
    { href: "/portal", label: t.nav.home, icon: "💬", count: waiting.length },
    { href: "/portal/results", label: t.nav.results, icon: "📈" },
    { href: "/portal/services", label: t.nav.services, icon: "✅" },
    { href: "/portal/requests", label: t.nav.requests, icon: "📨", count: requests.filter((r) => r.status !== "done").length },
    { href: "/portal/billing", label: t.nav.billing, icon: "🧾" },
    { href: "/portal/data", label: t.nav.data, icon: "🗂️" },
    { href: "/portal/settings", label: t.nav.settings, icon: "⚙️" },
  ];
  return (
    <AppShell door={t.door} nav={nav} brand={BRAND} company={org.name} user={user.name} banner={viewingAs ? t.viewingAs.replace("{company}", org.name) : null}
      lang={lang} langLabel={t.page.settings.lang} setLanguage={setLanguage} loginPath="/portal/login">
      {children}
    </AppShell>
  );
}
