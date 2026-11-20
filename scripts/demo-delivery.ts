import { eq } from "drizzle-orm";
import { createDb } from "../src/db";
import { invoices, jobs, memberships, organizations, partners, projectInputs, projects, user } from "../src/db/schema";
import { sendContract } from "../src/server/contracts";
import { markInvoicePaid } from "../src/server/finance";
import { deliver, offersFor, respondOffer } from "../src/server/partners";
import { demoSign } from "./demo-sign";
import { addInput, createOrder, createProject, humanReview, seedDelivery } from "../src/server/projects";

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
  // step 8: contract signed by the demo customer and deposit paid before the project starts
  const { contract } = await sendContract(db, actor, order.id);
  const [owner] = await db.select({ email: user.email, name: user.name }).from(memberships).innerJoin(user, eq(user.id, memberships.userId)).where(eq(memberships.orgId, rossi.id)).limit(1);
  await demoSign(db, contract.id, owner.email, owner.name);
  const [deposit] = await db.select().from(invoices).where(eq(invoices.contractId, contract.id));
  if (deposit) await markInvoicePaid(db, { type: "user", id: "demo-javad" }, deposit.id);
  const [{ id: projectId }] = await db.select({ id: projects.id }).from(projects).where(eq(projects.orderId, order.id));
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
// Customer material (step 7 intake): notes from the kick-off call, identity removed for partners; one item is
// left for the demo customer to answer in the chat ("Cosa vi serve da noi?").
const [rossiProject] = rossi ? await db.select().from(projects).where(eq(projects.orgId, rossi.id)).limit(1) : [];
if (rossiProject && !(await db.select({ id: projectInputs.id }).from(projectInputs).where(eq(projectInputs.projectId, rossiProject.id))).length) {
  await addInput(db, actor, { projectId: rossiProject.id, label: "Website form access", source: "meeting", text: "Call con Rossi Impianti Srl, 24/10: il modulo è su WordPress (Contact Form 7). Accesso admin lo manda Marco a giulia@rossi-impianti.it, tel. 333 765 4321." });
  await addInput(db, actor, { projectId: rossiProject.id, label: "CRM access", source: "meeting", text: "Usano Pipedrive, piano Essential. Utente API da creare." });
  console.log("demo material added");
}
await db.$client.end();
