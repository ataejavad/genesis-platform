import { requireAdmin } from "@/lib/auth";
import { BRAND } from "@/mock/data";
import { Shell } from "@/ui/Shell";

export const dynamic = "force-dynamic";

// Cockpit is English (Javad, 2026-10-22) and designed last: it gathers what every other area needs managed.
export default async function CockpitLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <Shell
      brand={BRAND}
      door="Cockpit"
      lang="en"
      user={{ name: user.name, sub: "Founder" }}
      groups={[
        { items: [
          { href: "/cockpit", label: "Today", icon: "📊" },
          { href: "/cockpit/approvals", label: "Approvals", icon: "✋", count: 5 },
        ] },
        { title: "Growth", items: [
          { href: "/cockpit/markets", label: "Markets & hubs", icon: "🎯" },
          { href: "/cockpit/outreach", label: "Outbound", icon: "📣" },
          { href: "/cockpit/crm", label: "CRM", icon: "📇" },
          { href: "/cockpit/customers", label: "Customers", icon: "🏢" },
          { href: "/cockpit/catalog", label: "Marketplace catalogue", icon: "🛒" },
        ] },
        { title: "Delivery", items: [
          { href: "/cockpit/projects", label: "Projects", icon: "📁" },
          { href: "/cockpit/partners", label: "Partners", icon: "🤝" },
          { href: "/cockpit/protocols", label: "Protocols", icon: "📐" },
          { href: "/cockpit/qa", label: "QA queue", icon: "🔍" },
          { href: "/cockpit/moderation", label: "Moderation", icon: "🛡️", count: 2 },
        ] },
        { title: "Money & legal", items: [
          { href: "/cockpit/contracts", label: "Contracts", icon: "📝" },
          { href: "/cockpit/finance", label: "Finance", icon: "💶" },
          { href: "/cockpit/outbox", label: "Outbox", icon: "📤" },
        ] },
        { title: "Machine", items: [
          { href: "/cockpit/agents", label: "Agent center", icon: "🤖" },
          { href: "/cockpit/experiments", label: "Experiments", icon: "🧪" },
          { href: "/cockpit/api", label: "API & connections", icon: "🔌" },
        ] },
      ]}
    >
      {children}
    </Shell>
  );
}
