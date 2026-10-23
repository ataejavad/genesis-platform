import { BRAND } from "@/mock/data";
import { Shell } from "@/ui/Shell";

// Partner portal (doc 15 §6ب): one dashboard, sections shift by role. Sample user: freelancer delivery supplier.
export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell
      brand={BRAND}
      door="پورتال همکاران"
      user={{ name: "Marco Rossi", sub: "همکار H-22 · فریلنسر · سطح حرفه‌ای" }}
      groups={[
        { items: [
          { href: "/partner", label: "خانه", icon: "🏠" },
          { href: "/partner/jobs", label: "صندوق کار", icon: "📥", count: 3 },
          { href: "/partner/tasks", label: "پروژه‌ها و کارها", icon: "🗂️", count: 2 },
          { href: "/partner/projects/P-302", label: "تحویل (پروژه جاری)", icon: "📤" },
          { href: "/partner/protocols", label: "پروتکل‌ها", icon: "📐" },
          { href: "/partner/messages", label: "پیام‌ها", icon: "💬" },
          { href: "/partner/services", label: "خدمات و ظرفیت", icon: "🧩" },
          { href: "/partner/rank", label: "رتبه و سطح", icon: "⭐" },
          { href: "/partner/earnings", label: "درآمد و تسویه", icon: "💶" },
          { href: "/partner/profile", label: "پروفایل و مدارک", icon: "👤" },
          { href: "/partner/learn", label: "یادگیری", icon: "🎓" },
        ] },
        { title: "فقط همکار داخلی", items: [{ href: "/partner/goals", label: "اهداف و KPI", icon: "🎯" }] },
      ]}
    >
      {children}
    </Shell>
  );
}
