import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { events, partnerDocuments, partners } from "@/db/schema";
import { maskContacts, match, tierOf } from "@/server/partner-rules";
import {
  addDocument,
  applyPartner,
  checkDocument,
  createJob,
  decideApplication,
  deliver,
  earnings,
  todayFor,
  issuePartnerKey,
  levelFor,
  markPaid,
  offerJob,
  offersFor,
  partnerForKey,
  respondOffer,
  reviewDelivery,
  sendPartnerMessage,
} from "@/server/partners";
import { authenticateAgent } from "@/server/api-keys";
import { detectPartnerIntent, partnerReply } from "@/server/partner-chat";
import { useTestDb } from "./helpers";

const db = useTestDb();
const javad = { type: "user", id: "javad" } as const;
const sys = { type: "system", id: "test" } as const;

async function activePartner(name: string, email: string, over: Record<string, unknown> = {}) {
  const a = await applyPartner(db, { kind: "person", name, email, country: "IT", languages: ["it", "en"], skills: ["automation", "crm"], links: ["https://example.com/cv"], consent: true, ...over });
  const d = await decideApplication(db, javad, a.id, true, "a-long-test-password");
  return { id: a.id, password: d.password };
}
const job = (over: Record<string, unknown> = {}) => createJob(db, javad, { title: "Connect web form to CRM", brief: "Every form lead lands in the CRM with source.", skills: ["automation", "crm"], language: "it", country: "IT", payEur: 300, dueAt: new Date(Date.now() + 5 * 864e5), checklist: ["Test lead arrives in CRM", "Source field filled"], ...over });

describe("partner rules", () => {
  it("explains every match and excludes partners that may not see personal data", () => {
    const p = { skills: ["automation"], languages: ["it"], country: "IT", capacity: 2, active: 0, stats: { accepted: 0, avgQuality: null, onTimeRate: null }, dpaSigned: false };
    const m = match({ skills: ["automation", "crm"], language: "it", country: "IT", personalData: false }, p)!;
    expect(m.why.find((w) => w.factor === "skills")).toEqual({ factor: "skills", points: 23, max: 45 });
    expect(m.fit).toBe(23 + 15 + 10 + 10 + 10);
    expect(match({ skills: ["automation"], language: null, country: null, personalData: true }, p)).toBeNull();
    expect(match({ skills: ["automation"], language: null, country: null, personalData: true }, { ...p, dpaSigned: true, country: "IR" })).toBeNull();
    expect(match({ skills: ["automation"], language: null, country: null, personalData: true }, { ...p, dpaSigned: true })).not.toBeNull();
  });

  it("tells the partner what the next level needs", () => {
    expect(tierOf({ accepted: 0, avgQuality: null, onTimeRate: null }).tier.id).toBe("new");
    const r = tierOf({ accepted: 4, avgQuality: 4.2, onTimeRate: 0.9 });
    expect(r.tier.id).toBe("rising");
    expect(r.next?.id).toBe("trusted");
    expect(r.missing).toEqual([{ what: "accepted", need: 10, have: 4 }]);
    expect(tierOf({ accepted: 30, avgQuality: 4.8, onTimeRate: 1 }).tier.payoutDays).toBe(3);
  });

  it("masks contact details", () => {
    const m = maskContacts("Scrivimi a mario@rossi.it o +39 333 123 4567, sito www.rossi.it, insta @mario_rossi");
    expect(m.flagged).toBe(true);
    expect(m.shown).not.toMatch(/rossi\.it|333|@mario/);
    expect(maskContacts("Consegno entro venerdì, 3 punti su 3").flagged).toBe(false);
  });
});

describe("partner flow", () => {
  it("applies once, screens by rules, opens a login on approval", async () => {
    const a = await applyPartner(db, { kind: "person", name: "Giulia", email: "G@x.test", country: "it", languages: ["it"], skills: ["content"], consent: true });
    expect((await applyPartner(db, { kind: "person", name: "Giulia", email: "g@x.test", country: "IT", skills: ["content"], consent: true })).duplicate).toBe(true);
    const [row] = await db.select().from(partners).where(eq(partners.id, a.id));
    expect(row.status).toBe("applied");
    expect(row.screening?.score).toBeGreaterThan(0);
    await expect(applyPartner(db, { kind: "person", name: "X", email: "x@x.test", country: "IT", skills: ["content"], consent: false as true })).rejects.toThrow();
    const d = await decideApplication(db, javad, a.id, true, "a-long-test-password");
    expect(d.password).toBe("a-long-test-password");
    const [after] = await db.select().from(partners).where(eq(partners.id, a.id));
    expect(after.status).toBe("active");
    expect(after.userId).toBeTruthy();
  });

  it("offers to the best matches, gives the job to the first who accepts, pays by level after review", async () => {
    const a = await activePartner("Anna", "anna@x.test");
    const b = await activePartner("Bruno", "bruno@x.test", { skills: ["content"], languages: ["de"], country: "DE" });
    const j = await job();
    const picks = await offerJob(db, javad, j.id, 3, 40);
    expect(picks.map((p) => p.name)).toEqual(["Anna"]);
    const [offer] = await offersFor(db, a.id);
    expect(offer.offer.why.length).toBe(5);
    expect(await offersFor(db, b.id)).toEqual([]);
    expect((await respondOffer(db, sys, a.id, offer.offer.id, true)).assigned).toBe(true);
    await expect(respondOffer(db, sys, a.id, offer.offer.id, true)).rejects.toThrow(/no longer open/);
    // delivery needs every checklist point ticked, and only by the assigned partner
    await expect(deliver(db, sys, a.id, j.id, { link: "https://drive.example/x", selfCheck: [true, false] })).rejects.toThrow(/checklist/);
    await expect(deliver(db, sys, b.id, j.id, { link: "https://drive.example/x", selfCheck: [true, true] })).rejects.toThrow(/not found/);
    const d1 = await deliver(db, sys, a.id, j.id, { link: "https://drive.example/x", note: "chiamami 333 1234567", selfCheck: [true, true] });
    expect(d1.note).not.toContain("1234567");
    await reviewDelivery(db, javad, d1.id, false, 3, "Source field empty");
    const d2 = await deliver(db, sys, a.id, j.id, { link: "https://drive.example/y", selfCheck: [true, true] });
    expect(d2.version).toBe(2);
    const now = new Date();
    const { payout } = await reviewDelivery(db, javad, d2.id, true, 5, "Great", now);
    expect(payout?.amountEur).toBe(300);
    expect(Math.round((payout!.dueAt.getTime() - now.getTime()) / 864e5)).toBe(14);
    expect((await levelFor(db, a.id)).stats).toEqual({ accepted: 1, avgQuality: 5, onTimeRate: 1 });
    await markPaid(db, javad, payout!.id);
    const e = await earnings(db, a.id);
    expect([e.paidEur, e.dueEur]).toEqual([300, 0]);
    const types = (await db.select().from(events)).map((x) => x.type);
    expect(types).toEqual(expect.arrayContaining(["job.offered", "job.assigned", "delivery.submitted", "delivery.reviewed", "payout.paid"]));
  });

  it("keeps personal-data jobs for partners with a checked DPA", async () => {
    const a = await activePartner("Anna", "anna@x.test");
    const j = await job({ personalData: true });
    expect(await offerJob(db, javad, j.id)).toEqual([]);
    const doc = await addDocument(db, sys, a.id, "dpa", "https://sign.example/dpa");
    await checkDocument(db, javad, doc.id, true);
    expect((await db.select().from(partnerDocuments).where(eq(partnerDocuments.id, doc.id)))[0].status).toBe("ok");
    expect((await offerJob(db, javad, j.id)).map((p) => p.name)).toEqual(["Anna"]);
  });

  it("masks what partners write and records review requests", async () => {
    const a = await activePartner("Anna", "anna@x.test");
    const m = await sendPartnerMessage(db, sys, a.id, "partner", "Why was I not offered the CRM job? mail me anna@private.it", { reviewRequest: true });
    expect(m.flagged).toBe(true);
    expect(m.shown).not.toContain("anna@private.it");
    expect(m.reviewRequest).toBe(true);
    const ev = await db.select().from(events).where(eq(events.type, "partner.message"));
    expect(ev[0].payload).toMatchObject({ reviewRequest: true, flagged: true });
  });

  it("gives an agent partner one working key; a new key revokes the old", async () => {
    const p = await activePartner("Bot Srl", "bot@example.com", { kind: "agent" });
    const first = await issuePartnerKey(db, javad, p.id);
    const auth = await authenticateAgent(db, `Bearer ${first}`, "partner:work");
    expect((await partnerForKey(db, auth.actor.apiKeyId)).id).toBe(p.id);
    const second = await issuePartnerKey(db, javad, p.id);
    await expect(authenticateAgent(db, `Bearer ${first}`, "partner:work")).rejects.toThrow(/revoked/);
    await expect(authenticateAgent(db, `Bearer ${second}`, "portal:write")).rejects.toThrow(/scope/);
  });

  it("puts today's priorities first and answers project questions in the chat", async () => {
    const p = await activePartner("Luca Verdi", "luca@example.com");
    const j = await job({ title: "Collegare il modulo al CRM", dueAt: new Date(Date.now() + 864e5) });
    await offerJob(db, javad, j.id, 1, 0);
    const [o] = await offersFor(db, p.id);
    await respondOffer(db, sys, p.id, o.offer.id, true);
    const late = await job({ title: "Report mensile clienti", dueAt: new Date(Date.now() - 864e5) });
    await offerJob(db, javad, late.id, 1, 0);
    await sendPartnerMessage(db, javad, p.id, "us", "Welcome aboard");
    const today = await todayFor(db, p.id);
    expect(today.map((i) => i.kind)).toEqual(["offer", "dueSoon", "message", "noDpa"]);

    expect(detectPartnerIntent("Cosa devo fare oggi?")).toBe("today");
    expect(detectPartnerIntent("What do I need for the next level?")).toBe("level");
    expect(detectPartnerIntent("Mi mandi la checklist del progetto CRM?")).toBe("job");
    expect(detectPartnerIntent("امروز چه کاری دارم؟")).toBe("today");
    const r = await partnerReply(db, p.id, "it", "Qual è la checklist del progetto modulo CRM?");
    expect(r.cards[0]).toMatchObject({ type: "job", data: { title: "Collegare il modulo al CRM", checklist: ["Test lead arrives in CRM", "Source field filled"] } });
    const m = await partnerReply(db, p.id, "en", "What did the team write me?");
    expect(m.cards[0]).toMatchObject({ type: "messages", data: [{ text: "Welcome aboard" }] });
  });
});
