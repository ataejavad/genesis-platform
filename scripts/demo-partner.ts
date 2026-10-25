import { eq } from "drizzle-orm";
import { createDb } from "../src/db";
import { organizations, partners } from "../src/db/schema";
import { addDocument, addService, applyPartner, checkDocument, createJob, decideApplication, deliver, offerJob, offersFor, respondOffer, reviewDelivery, sendPartnerMessage } from "../src/server/partners";

// A fictional demo partner so the partner portal can be tried: partner@local.test / local-demo-password.
// Runs once (skips when the demo partner exists). One finished job with a payout, two offers waiting, documents.
const db = createDb(process.env.DATABASE_URL!, 1);
const actor = { type: "system", id: "demo" } as const;
const EMAIL = "partner@local.test";

const [exists] = await db.select({ id: partners.id }).from(partners).where(eq(partners.email, EMAIL));
if (exists) {
  console.log("demo partner exists");
} else {
  const { id } = await applyPartner(db, {
    kind: "person", name: "Giulia Bianchi (demo)", email: EMAIL, country: "IT", languages: ["it", "en"], skills: ["automation", "crm", "ai-setup"],
    links: ["https://example.com/portfolio"], pitch: "Five years of n8n and HubSpot integrations for small Italian companies; I document every flow.", locale: "it", consent: true,
  });
  await decideApplication(db, actor, id, true, "local-demo-password");
  for (const kind of ["dpa", "nda", "vat"] as const) await checkDocument(db, actor, (await addDocument(db, actor, id, kind, `https://example.com/docs/${kind}.pdf`)).id, true);
  await addDocument(db, actor, id, "insurance", "https://example.com/docs/insurance.pdf", new Date(Date.now() + 20 * 864e5));
  await addService(db, actor, id, { title: "Lead form → CRM automation", skills: ["automation", "crm"], priceModel: "fixed", priceEur: 450, deliveryDays: 5 });

  const [customer] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.name, "Rossi Impianti Srl (demo)"));
  const due = (d: number) => new Date(Date.now() + d * 864e5);
  const job = (title: string, brief: string, skills: ("automation" | "crm" | "ai-setup")[], pay: number, days: number, checklist: string[]) =>
    createJob(db, actor, { title, brief, kind: customer ? "customer" : "internal", customerOrgId: customer?.id, skills, language: "it", country: "IT", personalData: true, payEur: pay, dueAt: due(days), checklist });

  // finished: delivered, accepted, payout due
  const done = await job("Collegare il modulo contatti al CRM", "Website form leads must reach the CRM with source and phone filled, plus an alert to the office.", ["automation", "crm"], 380, 3, ["Test lead arrives in the CRM", "Source field filled", "Office gets the alert"]);
  await offerJob(db, actor, done.id, 1, 0);
  const [o1] = await offersFor(db, id);
  await respondOffer(db, actor, id, o1.offer.id, true);
  const d = await deliver(db, actor, id, done.id, { link: "https://example.com/handover/crm-flow", note: "Flow documented in the handover page.", selfCheck: [true, true, true] });
  await reviewDelivery(db, actor, d.id, true, 5, "Clean work, documented. Thank you.");

  // two offers waiting for an answer
  for (const [t, b, s, pay, days, cl] of [
    ["Assistente telefonico: messaggio fuori orario", "Set up the after-hours greeting and the callback list for the phone assistant; test with three calls.", ["ai-setup"], 220, 6, ["Greeting matches the approved text", "Three test calls logged", "Callback list reaches the office"]],
    ["Promemoria automatici per i preventivi", "Send a friendly reminder 3 and 7 days after a quote, stop when the customer answers.", ["automation", "crm"], 300, 9, ["Reminders at day 3 and 7", "Stops when the customer replies", "Test run documented"]],
  ] as const) {
    const j = await job(t, b, [...s], pay, days, [...cl]);
    await offerJob(db, actor, j.id, 1, 0);
  }
  await sendPartnerMessage(db, actor, id, "us", "Benvenuta Giulia! Two new offers are waiting for you; payment for the CRM job is on its way.");
  console.log(`demo partner created: ${EMAIL} / local-demo-password (${id})`);
}
await db.$client.end();
