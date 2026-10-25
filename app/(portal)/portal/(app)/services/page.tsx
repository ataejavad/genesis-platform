import { portalCopy } from "@/config/portal-copy";
import { getDb } from "@/db";
import { requireCustomer } from "@/lib/portal-auth";
import { listServices, nextStep } from "@/server/portal";
import { customerProjects } from "@/server/projects";
import { NextCard, ProjectsCard, ServicesCard } from "@/ui/portal/Cards";
import { RequestForm } from "@/ui/portal/RequestForm";
import { PageHead } from "@/ui/Shell";

export default async function PortalServices() {
  const { org, lang } = await requireCustomer();
  const db = getDb();
  const t = portalCopy(lang);
  const [services, next, projects] = await Promise.all([listServices(db, org.id, lang), nextStep(db, org.id, lang), customerProjects(db, org.id)]);
  return (
    <main className="stack" style={{ maxWidth: 900 }}>
      <PageHead title={t.page.services.title} sub={t.page.services.sub} />
      {services.length ? <ServicesCard data={services} t={t} lang={lang} /> : <p className="muted">{t.r.servicesNone}</p>}
      {projects.some((p) => p.status !== "closed") && (<><h2>🚧 {t.r.projects}</h2><ProjectsCard data={projects.filter((p) => p.status !== "closed")} t={t} lang={lang} /></>)}
      {next && (<><h2>🪜 {t.r.next}</h2><NextCard data={next} t={t} lang={lang} /></>)}
      <h2>{t.page.services.change}</h2>
      <RequestForm t={t} kinds={["change", "support"]} />
    </main>
  );
}
