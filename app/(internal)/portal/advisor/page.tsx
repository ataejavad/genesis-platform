import { PageHead } from "@/ui/Shell";
import { AdvisorChat } from "@/ui/AdvisorChat";

export default function PortalAdvisor() {
  return (
    <main>
      <PageHead title="✦ مشاور AI شما" crumbs="پورتال مشتری" sub="فقط داده‌های شرکت خودتان را می‌بیند. بعداً به Claude وصل می‌شود؛ الان پاسخ‌ها نمونه‌اند." />
      <AdvisorChat />
    </main>
  );
}
