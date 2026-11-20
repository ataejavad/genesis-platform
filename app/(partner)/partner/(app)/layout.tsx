import { partnerCopy } from "@/config/partner-copy";
import { getDb } from "@/db";
import { requirePartner } from "@/lib/partner-auth";
import { BRAND } from "@/mock/data";
import { offersFor, workFor } from "@/server/partners";
import { setLanguage } from "@/ui/partner/actions";
import { AppShell } from "@/ui/portal/AppShell";

export const dynamic = "force-dynamic";

// Partner portal (doc 15 §6ب, step 6): home is the conversation, the rest are pages on the partner's own data.
export default async function PartnerLayout({ children }: { children: React.ReactNode }) {
  const { user, partner, lang, viewingAs } = await requirePartner();
  const db = getDb();
  const t = partnerCopy(lang);
  const [offers, work] = await Promise.all([offersFor(db, partner.id), workFor(db, partner.id)]);
  const nav = [
    { href: "/partner", label: t.nav.home, icon: "💬" },
    { href: "/partner/offers", label: t.nav.offers, icon: "📥", count: offers.length },
    { href: "/partner/work", label: t.nav.work, icon: "🛠️", count: work.filter((w) => w.job.status === "assigned").length },
    { href: "/partner/earnings", label: t.nav.earnings, icon: "💶" },
    { href: "/partner/level", label: t.nav.level, icon: "🏅" },
    { href: "/partner/services", label: t.nav.services, icon: "🧰" },
    { href: "/partner/profile", label: t.nav.profile, icon: "🗂️" },
    { href: "/partner/messages", label: t.nav.messages, icon: "✉️" },
  ];
  return (
    <AppShell door={t.door} nav={nav} brand={BRAND} company={partner.name} user={user.name} banner={viewingAs ? `Admin view: ${partner.name}` : null}
      lang={lang} langLabel={t.page.profile.languages} setLanguage={setLanguage} loginPath="/partner/login">
      {children}
    </AppShell>
  );
}
