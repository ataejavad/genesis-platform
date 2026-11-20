import { portalCopy } from "@/config/portal-copy";
import { getDb } from "@/db";
import { requireCustomer } from "@/lib/portal-auth";
import { listGoals, results } from "@/server/portal";
import { GoalsCard, ResultsCard } from "@/ui/portal/Cards";
import { PageHead } from "@/ui/Shell";

export default async function PortalResults() {
  const { org, lang } = await requireCustomer();
  const db = getDb();
  const t = portalCopy(lang);
  const [r, goals] = await Promise.all([results(db, org.id), listGoals(db, org.id, lang)]);
  return (
    <main className="stack" style={{ maxWidth: 900 }}>
      <PageHead title={t.page.results.title} sub={t.page.results.sub} />
      <ResultsCard data={r} t={t} lang={lang} full />
      <h2>🎯 {t.r.goals}</h2>
      {goals.length ? <GoalsCard data={goals} t={t} lang={lang} /> : <p className="muted">{t.r.goalsNone}</p>}
    </main>
  );
}
