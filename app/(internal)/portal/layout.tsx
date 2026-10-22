import { BRAND, customer } from "@/mock/data";
import { Shell } from "@/ui/Shell";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell
      brand={BRAND}
      door="پورتال مشتری"
      user={{ name: customer.contact, sub: customer.name }}
      groups={[{ items: [
        { href: "/portal", label: "داشبورد", icon: "🏠" },
        { href: "/portal/projects", label: "پروژه‌ها", icon: "📁", count: 2 },
        { href: "/portal/services", label: "خدمات و نردبان رشد", icon: "🪜" },
        { href: "/portal/advisor", label: "مشاور AI شما", icon: "✦" },
        { href: "/portal/reports", label: "گزارش‌های ماهانه", icon: "📈" },
        { href: "/portal/invoices", label: "فاکتورها", icon: "🧾" },
        { href: "/portal/company", label: "پروفایل و داده شرکت", icon: "🏢" },
      ] }]}
    >
      {children}
    </Shell>
  );
}
