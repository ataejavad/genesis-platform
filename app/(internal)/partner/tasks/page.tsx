import { tasks } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Board } from "@/ui/Board";

export default function PartnerTasks() {
  return (
    <main>
      <PageHead title="کارهای من" crumbs="پورتال همکاران" sub="کار را بین ستون‌ها جابه‌جا کن؛ اگر چیزی از ما لازم داری، یک «کار برای ما» بساز." actions={<button className="btn">+ کار برای ما (درخواست از شرکت)</button>} />
      <Board tasks={tasks.filter((t) => t.assignee === "H-22" || t.project === "P-302")} />
    </main>
  );
}
