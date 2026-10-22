import { BRAND, customer } from "@/mock/data";
import { Shell } from "@/ui/Shell";

// Customer dashboard: 10 sections decided with Javad (doc 15 §6و).
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell
      brand={BRAND}
      door="پورتال مشتری"
      user={{ name: customer.contact, sub: customer.name }}
      groups={[{ items: [
        { href: "/portal", label: "خانه", icon: "🏠" },
        { href: "/portal/advisor", label: "مشاور AI", icon: "✦" },
        { href: "/portal/projects", label: "پروژه‌ها", icon: "📁", count: 2 },
        { href: "/portal/apps", label: "اپ‌های من", icon: "🧩" },
        { href: "/portal/services", label: "نردبان رشد", icon: "🪜" },
        { href: "/portal/reports", label: "گزارش‌ها", icon: "📈" },
        { href: "/portal/inbox", label: "پیام و پشتیبانی", icon: "💬", count: 1 },
        { href: "/portal/billing", label: "قرارداد و فاکتور", icon: "🧾" },
        { href: "/portal/data", label: "داده من", icon: "🗂️" },
        { href: "/portal/settings", label: "تنظیمات و تیم", icon: "⚙️" },
      ] }]}
    >
      {children}
    </Shell>
  );
}
