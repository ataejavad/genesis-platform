import { eq } from "drizzle-orm";
import { createDb } from "../src/db";
import { organizations, partners } from "../src/db/schema";
import { demoSignPartner } from "./demo-sign";
import { addDocument, addService, applyPartner, checkDocument, createJob, decideApplication, deliver, offerJob, offersFor, respondOffer, reviewDelivery, sendPartnerMessage } from "../src/server/partners";

// A fictional demo partner so the partner portal can be tried: partner@local.test / local-demo-password.
// Runs once (skips when the demo partner exists). One finished job with a payout, two offers waiting, documents.
const db = createDb(process.env.DATABASE_URL!, 1);
const actor = { type: "system", id: "demo" } as const;
const EMAIL = "partner@local.test";

const [exists] = await db.select({ id: partners.id }).from(partners).where(eq(partners.email, EMAIL));
if (exists) {
  // partners need a signed framework agreement before offers (step 8); older demo databases get it here
  await demoSignPartner(db, exists.id);
  console.log("demo partner exists");
} else {
  const { id } = await applyPartner(db, {
    kind: "person", name: "Giulia Bianchi (demo)", email: EMAIL, country: "IT", languages: ["it", "en"], skills: ["automation", "crm", "ai-setup"],
    links: ["https://example.com/portfolio"], pitch: "Five years of n8n and HubSpot integrations for small Italian companies; I document every flow.", locale: "it", consent: true,
  });
  await decideApplication(db, actor, id, true, "local-demo-password");
  await demoSignPartner(db, id);
  for (const kind of ["dpa", "nda", "vat"] as const) await checkDocument(db, actor, (await addDocument(db, actor, id, kind, `https://example.com/docs/${kind}.pdf`)).id, true);
  await addDocument(db, actor, id, "insurance", "https://example.com/docs/insurance.pdf", new Date(Date.now() + 20 * 864e5));
  await addService(db, actor, id, { title: "Lead form → CRM automation", skills: ["automation", "crm"], priceModel: "fixed", priceEur: 450, deliveryDays: 5 });

  const [customer] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.name, "Rossi Impianti Srl (demo)"));
  const due = (d: number) => new Date(Date.now() + d * 864e5);
  const job = (title: string, brief: string, skills: ("automation" | "crm" | "ai-setup")[], pay: number, days: number, checklist: string[]) =>
    createJob(db, actor, { title, brief, kind: customer ? "customer" : "internal", customerOrgId: customer?.id, skills, language: "it", country: "IT", personalData: true, payEur: pay, dueAt: due(days), checklist });

  // finished: delivered, accepted, payout due
  const done = await job("Collegare il modulo contatti al CRM", "I contatti dal modulo del sito devono arrivare nel CRM con fonte e telefono compilati, più un avviso all'ufficio.", ["automation", "crm"], 380, 3, ["Il contatto di prova arriva nel CRM", "Campo fonte compilato", "L'ufficio riceve l'avviso"]);
  await offerJob(db, actor, done.id, 1, 0);
  const [o1] = await offersFor(db, id);
  await respondOffer(db, actor, id, o1.offer.id, true);
  const d = await deliver(db, actor, id, done.id, { link: "https://example.com/handover/crm-flow", note: "Flusso documentato nella pagina di consegna.", selfCheck: [true, true, true] });
  await reviewDelivery(db, actor, d.id, true, 5, "Lavoro pulito e documentato. Grazie.");

  // two offers waiting for an answer
  for (const [t, b, s, pay, days, cl] of [
    ["Assistente telefonico: messaggio fuori orario", "Imposta il messaggio fuori orario e la lista richiami dell'assistente telefonico; prova con tre chiamate.", ["ai-setup"], 220, 6, ["Il messaggio corrisponde al testo approvato", "Tre chiamate di prova registrate", "La lista richiami arriva all'ufficio"]],
    ["Promemoria automatici per i preventivi", "Invia un promemoria cortese 3 e 7 giorni dopo un preventivo; si ferma quando il cliente risponde.", ["automation", "crm"], 300, 9, ["Promemoria al giorno 3 e 7", "Si ferma quando il cliente risponde", "Prova documentata"]],
  ] as const) {
    const j = await job(t, b, [...s], pay, days, [...cl]);
    await offerJob(db, actor, j.id, 1, 0);
  }
  await sendPartnerMessage(db, actor, id, "us", "Benvenuta Giulia! Ti aspettano due nuove offerte; il pagamento per il lavoro sul CRM è in arrivo.");
  console.log(`demo partner created: ${EMAIL} / local-demo-password (${id})`);
}
await db.$client.end();
