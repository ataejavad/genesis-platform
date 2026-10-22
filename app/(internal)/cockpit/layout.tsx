import { requireAdmin } from "@/lib/auth";
import { BRAND } from "@/mock/data";
import { Shell } from "@/ui/Shell";

export const dynamic = "force-dynamic";

export default async function CockpitLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <Shell
      brand={BRAND}
      door="کابین مدیریت"
      user={{ name: user.name, sub: "مدیر" }}
      groups={[
        { items: [
          { href: "/cockpit", label: "نمای کلی", icon: "📊" },
          { href: "/cockpit/approvals", label: "صف تأیید", icon: "✅" },
        ] },
        { title: "فروش و مشتری", items: [
          { href: "/cockpit/markets", label: "بازارها (فیلترها)", icon: "🎯" },
          { href: "/cockpit/leads", label: "سرنخ‌ها و مشتری‌ها", icon: "📇" },
          { href: "/cockpit/contracts", label: "کارخانه قرارداد", icon: "📝" },
        ] },
        { title: "تحویل و همکاران", items: [
          { href: "/cockpit/projects", label: "پروژه‌ها و کارها", icon: "📁" },
          { href: "/cockpit/partners", label: "همکاران", icon: "🤝", count: 3 },
          { href: "/cockpit/protocols", label: "پروتکل‌ها", icon: "📐" },
          { href: "/cockpit/qa", label: "سنجش تحویل (QA)", icon: "🔍", count: 2 },
          { href: "/cockpit/moderation", label: "نظارت پیام‌ها", icon: "🛡️", count: 1 },
        ] },
        { title: "ماشین", items: [
          { href: "/cockpit/agents", label: "ایجنت‌ها", icon: "🤖" },
          { href: "/cockpit/api", label: "API و اتصال‌ها", icon: "🔌" },
        ] },
      ]}
    >
      {children}
    </Shell>
  );
}
