import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { events, jobs, lessons, notifications, orders, partners, prospects, serviceCosts, subscriptions, supplyGaps } from "@/db/schema";
import { billSubscriptions } from "@/server/finance";
import { needsYou } from "@/server/needs-you";
import { notifyEvent } from "@/server/notify";
import { opsWatch } from "@/server/ops-watch";
import { addDocument, applyPartner, checkDocument, decideApplication, deliver, offerJob, offersFor, respondOffer } from "@/server/partners";
import { addSubscription, createCustomer } from "@/server/portal";
import { detectIntent, scriptedReply } from "@/server/portal-chat";
import { createOrder, humanReview, rejectOrder, seedDelivery } from "@/server/projects";
import { cancelSubscription, endSubscriptions, keepSubscription, lowMargins, margins, monthlyService, recordCost, recordLoss } from "@/server/service";
import { inviteCandidates } from "@/server/supply";
import { signPartner, useTestDb } from "./helpers";

// Gap audit 2026-10-25b: what the monthly fee delivers, what it costs us, why customers leave, who we recruit.
const db = useTestDb();
const javad = { type: "user", id: "javad" } as const;
const sys = { type: "system", id: "test" } as const;
const NOV = new Date("2026-11-01T06:00:00Z");

async function customerWith(product: string, fee: number) {
  const { org } = await db.transaction((tx) => createCustomer(tx, sys, { name: "Rossi Impianti", country: "IT", industry: "installers", locale: "it", email: "r@rossi.test", contactName: "Rita" }));
  const sub = await addSubscription(db, sys, org.id, product, "Standard", fee, new Date("2026-10-10T10:00:00Z"));
  return { orgId: org.id, sub };
}

async function partner(email: string, skills = ["ai-setup", "automation"]) {
  const a = await applyPartner(db, { kind: "person", name: "Anna Neri", email, country: "IT", languages: ["it", "en"], skills, consent: true });
  await decideApplication(db, javad, a.id, true, "a-long-test-password");
  await signPartner(db, a.id);
  await checkDocument(db, javad, (await addDocument(db, javad, a.id, "dpa", "https://example.com/dpa.pdf")).id, true);
  return a.id;
}

describe("monthly service", () => {
  it("opens the package's check-up each month, books costs, and tells the customer when it is done", async () => {
    await seedDelivery(db);
    const { orgId, sub } = await customerWith("phone-agent", 390);
    const anna = await partner("anna@example.com");
    const r = await monthlyService(db, NOV);
    expect(r).toMatchObject({ period: "2026-11", jobs: 1, noProtocol: [] });
    expect(await monthlyService(db, NOV)).toMatchObject({ jobs: 0 }); // once per month
    const [job] = await db.select().from(jobs).where(eq(jobs.subscriptionId, sub.id));
    expect(job).toMatchObject({ period: "2026-11", payEur: 60, kind: "customer", customerOrgId: orgId, language: "it", status: "open" });
    expect(job.customerCode).not.toContain("Rossi"); // white-label
    expect(job.checklist.length).toBeGreaterThan(0);
    expect(job.dueAt.toISOString().slice(0, 10)).toBe("2026-11-04");

    // estimates: partner 60 + voice 70 + number 5 against the €390 fee
    let m = (await margins(db, "2026-11")).get(orgId)!;
    expect(m).toMatchObject({ feeEur: 390, costEur: 135, marginPct: 65, estimated: true });
    // the real voice bill replaces its estimate
    await recordCost(db, javad, { subscriptionId: sub.id, period: "2026-11", label: "Voice minutes (estimate)", kind: "usage", amountEur: 150 });
    m = (await margins(db, "2026-11")).get(orgId)!;
    expect(m.costEur).toBe(215);

    // the partner does the check: real cost booked, the customer is told
    await offerJob(db, sys, job.id); // the worker does this on job.opened
    for (const { offer } of await offersFor(db, anna)) await respondOffer(db, sys, anna, offer.id, true);
    const d = await deliver(db, sys, anna, job.id, { link: "https://example.com/check", selfCheck: job.checklist.map(() => true) });
    await humanReview(db, javad, d.id, job.checklist.map((_, idx) => ({ idx, result: "pass" as const })), 5, "ok");
    expect(await db.select().from(serviceCosts).where(and(eq(serviceCosts.subscriptionId, sub.id), eq(serviceCosts.source, "actual")))).toHaveLength(2);
    const [ev] = await db.select().from(events).where(eq(events.type, "service.checked"));
    expect(ev.payload).toMatchObject({ orgId, period: "2026-11", title: "Controllo e messa a punto mensile" });
    await notifyEvent(db, ev);
    expect((await db.select().from(notifications).where(eq(notifications.template, "serviceChecked")))[0]).toMatchObject({ email: "r@rossi.test" });

    // costs above the floor: red in the cockpit and flagged
    await recordCost(db, javad, { subscriptionId: sub.id, period: "2026-11", label: "Voice minutes (estimate)", kind: "usage", amountEur: 260 });
    expect((await lowMargins(db, new Date("2026-11-15T10:00:00Z"))).map((x) => x.orgId)).toEqual([orgId]);
    expect((await opsWatch(db, new Date("2026-11-15T10:00:00Z"))).items.some((i) => i.kind === "margin")).toBe(true);
  });

  it("a job nobody can take opens a recruiting gap; an earlier applicant comes back and closes it", async () => {
    await seedDelivery(db);
    const { sub } = await customerWith("phone-agent", 390);
    // turned down earlier, has the skill
    const old = await applyPartner(db, { kind: "person", name: "Luca Bianchi", email: "luca@example.com", country: "IT", languages: ["it"], skills: ["ai-setup"], consent: true });
    await decideApplication(db, javad, old.id, false);
    await monthlyService(db, NOV);
    const w = await opsWatch(db, new Date("2026-11-01T08:00:00Z"));
    expect(w.items.find((i) => i.kind === "no_match")?.text).toContain("recruiting post ready");
    const [gap] = await db.select().from(supplyGaps);
    expect(gap).toMatchObject({ skill: "ai-setup", language: "it", status: "open", candidates: [old.id] });
    expect(gap.post).toContain("/en/partners");
    await opsWatch(db, new Date("2026-11-01T09:00:00Z"));
    expect(await db.select().from(supplyGaps)).toHaveLength(1); // one gap per skill and language
    expect((await needsYou(db)).find((n) => n.id === "gaps")?.n).toBe(1);

    expect(await inviteCandidates(db, javad, gap.id)).toBe(1);
    expect((await db.select().from(notifications).where(eq(notifications.template, "recruitInvite")))[0]).toMatchObject({ email: "luca@example.com" });
    // the invited person applies again: back in Javad's queue, then accepted → gap closed
    expect(await applyPartner(db, { kind: "person", name: "Luca Bianchi", email: "luca@example.com", country: "IT", languages: ["it"], skills: ["ai-setup"], consent: true })).toMatchObject({ id: old.id, duplicate: false });
    expect((await db.select().from(partners).where(eq(partners.id, old.id)))[0].status).toBe("applied");
    await decideApplication(db, javad, old.id, true, "a-long-test-password");
    expect((await db.select().from(supplyGaps))[0].status).toBe("closed");
    expect(sub.id).toBeTruthy();
  });
});

describe("leaving and losing", () => {
  it("the customer gives notice in the chat with a reason; billed through the notice, then it ends", async () => {
    await seedDelivery(db);
    const { orgId, sub } = await customerWith("followup-agent", 190);
    expect(detectIntent("vorrei disdire l'abbonamento")).toBe("cancel");
    expect(detectIntent("ich möchte kündigen")).toBe("cancel");
    expect(detectIntent("I want to cancel my subscription")).toBe("cancel");
    expect(detectIntent("می‌خواهم اشتراک را لغو کنم")).toBe("cancel");
    const r = await scriptedReply(db, orgId, "it", "vorrei disdire il servizio");
    expect(r.cards).toMatchObject([{ type: "cancel", data: { subs: [{ id: sub.id, monthlyEur: 190 }] } }]);

    const at = new Date("2026-11-05T10:00:00Z");
    const { endsAt } = await cancelSubscription(db, sys, orgId, sub.id, "price", "troppo per noi adesso", at);
    expect(endsAt.toISOString().slice(0, 10)).toBe("2026-12-05");
    await expect(cancelSubscription(db, sys, orgId, sub.id, "price")).rejects.toMatchObject({ status: 409 });
    expect((await scriptedReply(db, orgId, "it", "vorrei disdire il servizio")).cards).toEqual([]);
    expect((await needsYou(db, at)).find((n) => n.id === "notices")?.n).toBe(1);
    const [ev] = await db.select().from(events).where(eq(events.type, "subscription.cancelled"));
    expect(ev.payload).toMatchObject({ company: "Rossi Impianti", reason: "price" });
    await notifyEvent(db, ev);
    expect(await db.select().from(notifications).where(eq(notifications.template, "cancelConfirm"))).toHaveLength(1);

    // December falls inside the notice and is billed; January is not
    expect(await billSubscriptions(db, new Date("2026-12-01T09:00:00Z"))).toBe(1);
    expect(await endSubscriptions(db, new Date("2026-12-06T00:00:00Z"))).toBe(1);
    expect(await billSubscriptions(db, new Date("2027-01-01T09:00:00Z"))).toBe(0);
    expect((await monthlyService(db, new Date("2027-01-01T06:00:00Z"))).jobs).toBe(0);
  });

  it("a customer won back keeps the service", async () => {
    const { orgId, sub } = await customerWith("lead-crm", 90);
    await cancelSubscription(db, sys, orgId, sub.id, "timing");
    await keepSubscription(db, javad, sub.id);
    expect((await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id)))[0]).toMatchObject({ endsAt: null, status: "active" });
  });

  it("every loss keeps its reason; the same reason three times in 30 days becomes one sales lesson", async () => {
    await seedDelivery(db);
    const order = await createOrder(db, sys, { packageSlug: "lead-crm", source: "market", company: "Verdi Snc", email: "verdi@example.com", country: "IT", industry: "installers", locale: "it" });
    await rejectOrder(db, javad, order.id, "budget next year", "price");
    expect((await db.select().from(orders).where(eq(orders.id, order.id)))[0].lostReason).toBe("price");
    const [p] = await db.insert(prospects).values({ name: "Bruni Srl", key: "bruni-srl", country: "IT", industry: "installers", source: "registry" }).returning();
    const { setStage } = await import("@/server/crm");
    await setStage(db, javad, p.id, "lost", "chose a local firm", "price");
    expect((await db.select().from(prospects).where(eq(prospects.id, p.id)))[0]).toMatchObject({ stage: "lost", lostReason: "price" });
    expect(await db.select().from(lessons)).toHaveLength(0);
    await db.transaction((tx) => recordLoss(tx, sys, "churn", "price"));
    await db.transaction((tx) => recordLoss(tx, sys, "churn", "price"));
    const ls = await db.select().from(lessons);
    expect(ls).toHaveLength(1);
    expect(ls[0]).toMatchObject({ area: "sales" });
    expect(ls[0].text).toContain("price");
  });
});
