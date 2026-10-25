import { eq } from "drizzle-orm";
import { createDb } from "../src/db";
import { jobs, organizations, partners, projects } from "../src/db/schema";
import { deliver, offersFor, respondOffer } from "../src/server/partners";
import { convertOrder, createOrder, createProject, humanReview, seedDelivery } from "../src/server/projects";

// Step 7 demo: first protocols and packages (always, idempotent), then once: a customer project waiting for
// the demo customer's OK, an internal project with a delivery in the QA queue, and a new marketplace order.
const db = createDb(process.env.DATABASE_URL!, 1);
const actor = { type: "system", id: "demo" } as const;

await seedDelivery(db);
const [any] = await db.select({ id: projects.id }).from(projects).limit(1);
const [rossi] = await db.select().from(organizations).where(eq(organizations.name, "Rossi Impianti Srl (demo)"));
const [giulia] = await db.select().from(partners).where(eq(partners.email, "partner@local.test"));
if (any || !rossi || !giulia) {
  console.log(any ? "demo projects exist" : "demo projects skipped (needs the demo customer and partner)");
} else {
  const take = async (projectId: string) => {
    for (const { offer, job } of await offersFor(db, giulia.id)) if (job.projectId === projectId) await respondOffer(db, actor, giulia.id, offer.id, true);
    return db.select().from(jobs).where(eq(jobs.projectId, projectId));
  };
  // 1. Rossi ordered "every lead in the CRM" from the dashboard; done and checked, now waiting for Rossi's OK
  const order = await createOrder(db, actor, { packageSlug: "lead-crm", source: "portal", orgId: rossi.id, locale: "it" });
  const { projectId } = await convertOrder(db, actor, order.id);
  for (const j of (await take(projectId)).filter((x) => x.status === "assigned")) {
    const d = await deliver(db, actor, giulia.id, j.id, { link: "https://example.com/handover/lead-crm", note: "Collegato con webhook nativo; guida nella pagina di consegna.", selfCheck: j.checklist.map(() => true) });
    await humanReview(db, { type: "user", id: "demo-javad" }, d.id, j.checklist.map((_, idx) => ({ idx, result: "pass" as const })), 5, "Ottimo lavoro, grazie.");
  }
  // 2. Our own phone line (internal project): first task delivered, waiting in the QA queue
  const own = await createProject(db, actor, { orgId: null, packageSlug: "phone-agent", language: "it" });
  const [first] = (await take(own.id)).filter((x) => x.status === "assigned");
  if (first) await deliver(db, actor, giulia.id, first.id, { link: "https://example.com/handover/phone", note: "20 chiamate di prova nel registro allegato.", selfCheck: first.checklist.map(() => true) });
  // 3. A new order from the marketplace, waiting in Cockpit › Projects
  await createOrder(db, { type: "system", id: "marketplace" }, { packageSlug: "phone-agent", source: "market", company: "Bianchi Serramenti (demo)", email: "bianchi@example.com", vat: "IT01234567890", country: "IT", industry: "glass", locale: "it" });
  console.log("demo projects created");
}
await db.$client.end();
