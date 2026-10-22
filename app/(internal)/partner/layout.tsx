import { BRAND } from "@/mock/data";
import { Shell } from "@/ui/Shell";

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell
      brand={BRAND}
      door="پورتال همکاران"
      user={{ name: "Marco Rossi", sub: "همکار H-22 · فریلنسر" }}
      groups={[{ items: [
        { href: "/partner", label: "داشبورد", icon: "🏠" },
        { href: "/partner/tasks", label: "کارهای من", icon: "🗂️", count: 2 },
        { href: "/partner/projects/P-302", label: "پروژه جاری", icon: "📁" },
        { href: "/partner/profile", label: "پروفایل، رزومه و خدمات", icon: "👤" },
        { href: "/partner/earnings", label: "درآمد و تسویه", icon: "💶" },
      ] }]}
    >
      {children}
    </Shell>
  );
}
