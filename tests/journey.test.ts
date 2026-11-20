import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { complaints, customerApprovals, customerRequests, jobOffers, jobs, milestones, orders, projects } from "@/db/schema";
import { draftBrief, quoteRequest } from "@/server/brief";
import { complain, escalate, resolveComplaint } from "@/server/complaints";
import { needsYou } from "@/server/needs-you";
import { opsWatch } from "@/server/ops-watch";
import { addDocument, applyPartner, checkDocument, decideApplication, deliver, offerJob, offersFor, respondOffer } from "@/server/partners";
import { createCustomer, createRequest, decideCustomerApproval } from "@/server/portal";
import { detectIntent, scriptedReply } from "@/server/portal-chat";
import { createOrder, humanReview, seedDelivery } from "@/server/projects";
import { signPartner, startOrder, useTestDb } from "./helpers";

// Customer journey lessons from Upwork, Fiverr and Toptal (2026-10-25): brief card, 24h price, complaint ladder.
const db = useTestDb();
const javad = { type: "user", id: "javad" } as const;
const sys = { type: "system", id: "test" } as const;
const HOUR = 36e5;

async function partner(email: string, name = "Anna Neri") {
  const a = await applyPartner(db, { kind: "person", name, email, country: "IT", languages: ["it", "en"], skills: ["automation", "crm", "ai-setup"], consent: true });
  await decideApplication(db, javad, a.id, true, "a-long-test-password");
  await signPartner(db, a.id);
  await checkDocument(db, javad, (await addDocument(db, javad, a.id, "dpa", "https://example.com/dpa.pdf")).id, true);
  return a.id;
}

async function deliverAll(partnerId: string, projectId: string) {
  for (const { offer } of await offersFor(db, partnerId)) await respondOffer(db, sys, partnerId, offer.id, true);
  for (const j of (await db.select().from(jobs).where(eq(jobs.projectId, projectId))).filter((x) => x.status === "assigned" && x.partnerId === partnerId)) {
    const d = await deliver(db, sys, partnerId, j.id, { link: "https://example.com/work", selfCheck: j.checklist.map(() => true) });
    await humanReview(db, javad, d.id, j.checklist.map((_, idx) => ({ idx, result: "pass" as const })), 5, "ok");
  }
}

describe("brief card and the 24h price", () => {
  it("matches a catalogue result from the customer's words, else promises a price within 24 hours", async () => {
    await seedDelivery(db);
    const phone = await draftBrief(db, "it", "perdiamo troppe chiamate quando siamo in cantiere");
    expect(phone.package).toMatchObject({ slug: "phone-agent", setupEur: 490, monthlyEur: 390, revisions: 2, days: 15 });
    expect(phone.package!.steps).toEqual(["Configurato e collaudato", "Prima settimana live verificata"]);
    expect(phone.quoteBy).toBeNull();
    const other = await draftBrief(db, "de", "unsere Lagerbestände stimmen nie", new Date("2026-11-02T10:00:00Z"));
    expect(other).toMatchObject({ package: null, quoteBy: "2026-11-03T10:00:00.000Z" });
  });

  it("puts a brief card in the chat and lets Javad quote the request with a catalogue result", async () => {
    await seedDelivery(db);
    const { org } = await db.transaction((tx) => createCustomer(tx, sys, { name: "Gialli Srl", country: "IT", industry: "installers", locale: "it", email: "g@gialli.test", contactName: "Gino" }));
    const r = await scriptedReply(db, org.id, "it", "abbiamo un problema: i preventivi restano senza risposta per settimane");
    expect(r.cards).toMatchObject([{ type: "brief", data: { package: { slug: "followup-agent" } } }]);
    // a problem we price by hand: the promise is on the request, ops-watch flags it after 24 hours
    const req = await createRequest(db, sys, org.id, null, "solution", "il magazzino non torna mai", { problem: "il magazzino non torna mai", package: null });
    expect(req.dueAt!.getTime() - req.createdAt.getTime()).toBeGreaterThanOrEqual(23.9 * HOUR);
    expect((await needsYou(db)).find((n) => n.id === "quotes")?.n).toBe(1);
    const late = await opsWatch(db, new Date(Date.now() + 25 * HOUR));
    expect(late.items.find((i) => i.kind === "request")?.text).toContain("PRICE PROMISED");
    await quoteRequest(db, javad, req.id, "lead-crm");
    const [answered] = await db.select().from(customerRequests).where(eq(customerRequests.id, req.id));
    expect(answered.status).toBe("done");
    expect(answered.reply).toContain("450");
    expect(await db.select().from(orders).where(eq(orders.orgId, org.id))).toMatchObject([{ packageSlug: "lead-crm", source: "request", status: "new" }]);
  });
});

describe("complaint path", () => {
  it("climbs free fix → another partner → Javad, and ends when the fixed step is accepted", async () => {
    await seedDelivery(db);
    const anna = await partner("anna@example.com");
    const order = await createOrder(db, sys, { packageSlug: "lead-crm", source: "market", company: "Verdi Snc", email: "verdi@example.com", country: "IT", industry: "installers", locale: "it" });
    const { projectId } = await startOrder(db, javad, order.id);
    await deliverAll(anna, projectId);
    const [p] = await db.select().from(projects).where(eq(projects.id, projectId));
    const orgId = p.orgId!;
    expect(detectIntent("non siamo soddisfatti del lavoro")).toBe("complaint");
    expect((await scriptedReply(db, orgId, "it", "non siamo soddisfatti del lavoro")).cards).toMatchObject([{ type: "complaint", data: { step: "fix", open: false } }]);

    // 1. free fix by the same partner; the pending OK is closed with the complaint as its note
    const one = await complain(db, sys, orgId, null, "i contatti arrivano senza telefono");
    expect(one.step).toBe("fix");
    const [m] = await db.select().from(milestones).where(eq(milestones.projectId, projectId));
    expect(m.status).toBe("changes");
    expect((await db.select().from(customerApprovals).where(eq(customerApprovals.orgId, orgId)))[0]).toMatchObject({ status: "changes", note: "i contatti arrivano senza telefono" });
    const fix = (await db.select().from(jobs).where(eq(jobs.milestoneId, m.id))).find((j) => j.role === "revision")!;
    expect(fix).toMatchObject({ partnerId: anna, payEur: 0, status: "assigned" });
    expect((await scriptedReply(db, orgId, "it", "non sono soddisfatto")).cards).toMatchObject([{ type: "complaint", data: { step: "swap", open: true } }]);

    // 2. someone new redoes it at our cost; the partner being replaced is never offered it
    const luca = await partner("luca@example.com", "Luca Bianchi");
    const two = await complain(db, sys, orgId, null, "ancora uguale");
    expect(two.step).toBe("swap");
    const swap = (await db.select().from(jobs).where(eq(jobs.milestoneId, m.id))).filter((j) => j.role === "revision").find((j) => j.id !== fix.id)!;
    expect(swap.payEur).toBeGreaterThan(0);
    expect((await db.select().from(jobs).where(eq(jobs.id, fix.id)))[0].status).toBe("cancelled");
    await offerJob(db, sys, swap.id); // the worker does this on job.opened
    const offered = (await db.select().from(jobOffers).where(eq(jobOffers.jobId, swap.id))).filter((o) => o.status !== "withdrawn").map((o) => o.partnerId);
    expect(offered).toEqual([luca]);

    // the new partner delivers; the customer has not looked yet
    await deliverAll(luca, projectId);
    expect((await db.select().from(milestones).where(eq(milestones.id, m.id)))[0].status).toBe("ready");

    // 3. Javad; overdue steps reach him through Needs you and ops-watch
    const three = await escalate(db, sys, (await db.select().from(complaints))[0].id, "voglio parlare con qualcuno");
    expect(three.step).toBe("founder");
    expect((await needsYou(db)).find((n) => n.id === "complaints")?.n).toBe(1);
    expect((await opsWatch(db, new Date(Date.now() + 2 * 864e5))).items.some((i) => i.kind === "complaint")).toBe(true);

    // the new partner's work is accepted by the customer: the complaint ends on its own
    const ask = (await db.select().from(customerApprovals).where(eq(customerApprovals.orgId, orgId))).find((a) => a.status === "pending")!;
    await decideCustomerApproval(db, sys, orgId, ask.id, "approved", undefined, { stars: 5 });
    expect((await db.select().from(complaints))[0]).toMatchObject({ status: "resolved", resolvedBy: "milestone:customer" });
    await expect(resolveComplaint(db, javad, (await db.select().from(complaints))[0].id, "done")).rejects.toMatchObject({ status: 404 });
  });

  it("without anything delivered yet, a complaint is a support request", async () => {
    const { org } = await db.transaction((tx) => createCustomer(tx, sys, { name: "Neri Srl", country: "IT", industry: "installers", locale: "it", email: "n@neri.test", contactName: "Nina" }));
    expect((await complain(db, sys, org.id, null, "non siamo soddisfatti")).step).toBe("support");
    expect(await db.select().from(customerRequests).where(eq(customerRequests.orgId, org.id))).toMatchObject([{ kind: "support" }]);
  });
});
