import { MODULES } from "@/config/modules";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { BRAND } from "@/mock/data";
import { needsYou } from "@/server/needs-you";
import { JumpBar } from "@/ui/JumpBar";
import { type NavGroup, Shell } from "@/ui/Shell";

export const dynamic = "force-dynamic";

// Cockpit is English (Javad, 2026-10-22) and designed last: it gathers what every other area needs managed.
export default async function CockpitLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  // menu counts are real: the "Needs you" inbox and the messages to look at
  const needs = await needsYou(getDb()).catch(() => []);
  const total = needs.reduce((t, x) => t + x.n, 0);
  const count = (id: string) => needs.find((x) => x.id === id)?.n;
  const groups: NavGroup[] = [
    { items: [
      { href: "/cockpit", label: "Today", icon: "📊" },
      { href: "/cockpit/approvals", label: "Needs you", icon: "✋", count: total },
      { href: "/cockpit/systems", label: "Systems", icon: "🧭" },
    ] },
    { title: "Growth", items: [
      { href: "/cockpit/markets", label: "Markets & hubs", icon: "🎯" },
      { href: "/cockpit/outreach", label: "Outbound", icon: "📣" },
      { href: "/cockpit/leads", label: "Leads", icon: "✉️" },
      { href: "/cockpit/crm", label: "CRM", icon: "📇" },
      { href: "/cockpit/customers", label: "Customers", icon: "🏢" },
      { href: "/cockpit/catalog", label: "Marketplace catalogue", icon: "🛒" },
    ] },
    { title: "Delivery", items: [
      { href: "/cockpit/projects", label: "Projects", icon: "📁" },
      { href: "/cockpit/partners", label: "Partners", icon: "🤝" },
      { href: "/cockpit/protocols", label: "Protocols", icon: "📐" },
      { href: "/cockpit/qa", label: "QA queue", icon: "🔍" },
      { href: "/cockpit/moderation", label: "Moderation", icon: "🛡️", count: count("moderation") },
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
  ];
  return (
    <Shell
      brand={BRAND}
      door="Cockpit"
      lang="en"
      user={{ name: user.name, sub: "Founder" }}
      groups={groups}
      demo={false}
      command={<JumpBar items={[...groups.flatMap((g) => g.items.map((it) => ({ label: it.label, href: it.href, hint: g.title ?? "Cockpit" }))), ...MODULES.map((m) => ({ label: m.name, href: m.link, hint: `module ${m.n}` }))]} />}
    >
      {children}
    </Shell>
  );
}
