import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { customerApprovals, customerRequests, events, jobs, milestones, payouts, projects, subscriptions } from "@/db/schema";
import { billNext, markInvoicePaid } from "@/server/finance";
import { health, qaRoute, riskOf } from "@/server/delivery-rules";
import { addDocument, applyPartner, checkDocument, decideApplication, deliver, offersFor, respondOffer, statsFor } from "@/server/partners";
import { decideCustomerApproval } from "@/server/portal";
import {
  approveVersion,
  createOrder,
  customerProjects,
  deliveryWatch,
  draftVersion,
  humanReview,
  listProjects,
  listProtocols,
  projectDetail,
  qaQueue,
  quoteChange,
  seedDelivery,
} from "@/server/projects";
import { signPartner, startOrder, useTestDb } from "./helpers";

const db = useTestDb();
const javad = { type: "user", id: "javad" } as const;
const sys = { type: "system", id: "test" } as const;

async function partner(email: string) {
  const a = await applyPartner(db, { kind: "person", name: "Anna Neri", email, country: "IT", languages: ["it", "en"], skills: ["automation", "crm", "ai-setup"], consent: true });
  await decideApplication(db, javad, a.id, true, "a-long-test-password");
  await signPartner(db, a.id);
  await checkDocument(db, javad, (await addDocument(db, javad, a.id, "dpa", "https://example.com/dpa.pdf")).id, true);
  return a.id;
}

/** The partner takes, delivers and passes every task of the project's open milestones. */
async function deliverAll(partnerId: string, projectId: string) {
  for (const { offer } of await offersFor(db, partnerId)) await respondOffer(db, sys, partnerId, offer.id, true);
  const open = await db.select().from(jobs).where(eq(jobs.projectId, projectId));
  for (const j of open.filter((x) => x.status === "assigned")) {
    const d = await deliver(db, sys, partnerId, j.id, { link: "https://example.com/work", selfCheck: j.checklist.map(() => true) });
    await humanReview(db, javad, d.id, j.checklist.map((_, idx) => ({ idx, result: "pass" as const })), 5, "ok");
  }
}

describe("delivery rules", () => {
  it("tiers risk and routes QA", () => {
    expect(riskOf({ priceEur: 490, fromPackage: true }).level).toBe("low");
    expect(riskOf({ priceEur: 490, fromPackage: false }).level).toBe("medium");
    expect(riskOf({ priceEur: 4000, fromPackage: true }).level).toBe("high");
    const base = { risk: "low" as const, judge: { verdict: "accept" as const }, partnerTier: "trusted", lastMilestone: false, sample: 0.5 };
    expect(qaRoute(base).route).toBe("auto");
    expect(qaRoute({ ...base, sample: 0.1 }).route).toBe("human");
    expect(qaRoute({ ...base, judge: null }).route).toBe("human");
    expect(qaRoute({ ...base, risk: "medium", lastMilestone: true }).route).toBe("human");
    expect(qaRoute({ ...base, partnerTier: "new" }).route).toBe("human");
  });

  it("flags budget burn ahead of progress, late tasks and thin margins", () => {
    const now = new Date();
    const h = health({ priceEur: 500, budgetEur: 300, costEur: 260, tasks: [{ payEur: 200, status: "assigned", dueAt: new Date(now.getTime() - 864e5) }, { payEur: 100, status: "accepted", dueAt: now }], waiting: [], now });
    expect(h.flags).toEqual(["budget 87% spent at 33% done", "1 task(s) late"]);
  });
});

describe("order to closed project", () => {
  it("runs the whole line: order → project → partner → QA → customer → monthly service", async () => {
    await seedDelivery(db);
    await seedDelivery(db); // idempotent
    const pid = await partner("anna@example.com");
    const order = await createOrder(db, sys, { packageSlug: "phone-agent", source: "market", company: "Bianchi Impianti", email: "info@bianchi.example", country: "IT", industry: "installers", locale: "it" });
    const { projectId, password } = await startOrder(db, javad, order.id);
    expect(password.length).toBeGreaterThan(8);
    const d = await projectDetail(db, projectId);
    expect(d.project).toMatchObject({ code: "P-1001", risk: "low", priceEur: 490, monthlyEur: 390, budgetEur: 310, language: "it" });
    expect(d.milestones.map((m) => [m.amountEur, m.status])).toEqual([[245, "open"], [245, "planned"]]);
    // tasks carry the protocol's criteria in the customer's language, white-label code; only the paid milestone's went out
    const first = d.tasks.find((t) => t.job.milestoneId === d.milestones[0].id)!;
    expect(first.job.checklist[0]).toBe("L'assistente dice di essere un'AI nella prima frase");
    expect(first.job.customerCode).toMatch(/^C-.{4} · installers · IT$/);
    expect(first.job.status).toBe("offered");
    expect(d.tasks.find((t) => t.job.milestoneId === d.milestones[1].id)!.job.status).toBe("held");

    await deliverAll(pid, projectId);
    const orgId = d.project.orgId ?? (await db.select().from(projects).where(eq(projects.id, projectId)))[0].orgId!;
    const asks = await db.select().from(customerApprovals).where(eq(customerApprovals.orgId, orgId));
    expect(asks).toHaveLength(1);
    const shown = (await customerProjects(db, orgId))[0];
    expect(shown).toMatchObject({ code: "P-1001" });
    expect(shown.progress).toBeGreaterThan(0);
    expect(shown.progress).toBeLessThan(1);
    expect(shown.milestones.map((x) => x.status)).toEqual(["ready", "planned"]);

    // approved with a rating → the next milestone is billed first and starts when paid
    await decideCustomerApproval(db, javad, orgId, asks[0].id, "approved", undefined, { stars: 4, note: "bene" });
    let ms = await db.select().from(milestones).where(eq(milestones.projectId, projectId)).orderBy(milestones.seq);
    expect(ms[0]).toMatchObject({ status: "accepted", rating: 4, acceptedBy: "customer" });
    const inv = await billNext(db, projectId);
    expect(inv).toMatchObject({ kind: "milestone", netEur: 245 });
    await markInvoicePaid(db, javad, inv!.id);
    await deliverAll(pid, projectId);
    ms = await db.select().from(milestones).where(eq(milestones.projectId, projectId)).orderBy(milestones.seq);
    expect(ms[1].status).toBe("ready");

    // changes within the 2 free rounds go straight back to the partner who made it, at no extra pay
    const askOf = async () => (await db.select().from(customerApprovals).where(eq(customerApprovals.orgId, orgId))).find((x) => x.status === "pending")!;
    for (const round of [1, 2]) {
      await decideCustomerApproval(db, javad, orgId, (await askOf()).id, "changes", "the greeting is too long");
      const [m] = await db.select().from(milestones).where(eq(milestones.id, ms[1].id));
      expect(m).toMatchObject({ status: "changes", revisions: round });
      const rework = (await db.select().from(jobs).where(eq(jobs.milestoneId, m.id))).find((j) => j.role === "revision" && j.status === "assigned")!;
      expect(rework).toMatchObject({ partnerId: pid, payEur: 0 });
      expect(rework.brief).toContain("the greeting is too long");
      const dl = await deliver(db, sys, pid, rework.id, { link: "https://example.com/v2", selfCheck: rework.checklist.map(() => true) });
      await humanReview(db, javad, dl.id, rework.checklist.map((_, idx) => ({ idx, result: "pass" as const })), 5, "ok");
      expect((await db.select().from(milestones).where(eq(milestones.id, m.id)))[0].status).toBe("ready");
    }
    // a third round is priced first: a change request for Javad, and the step can still be accepted as it is
    await decideCustomerApproval(db, javad, orgId, (await askOf()).id, "changes", "now also a new menu");
    const [capped] = await db.select().from(milestones).where(eq(milestones.id, ms[1].id));
    expect(capped).toMatchObject({ status: "ready", revisions: 2 });
    expect((await askOf()).detail).toContain("2");
    expect((await db.select().from(customerRequests).where(eq(customerRequests.orgId, orgId))).map((r) => r.kind)).toEqual(["change"]);
    expect((await db.select().from(payouts)).every((p) => p.amountEur > 0)).toBe(true);
    expect((await db.select().from(projects).where(eq(projects.id, projectId)))[0].status).toBe("running");

    // a change request is priced and needs the customer's yes; then it is part of the project
    const cr = await quoteChange(db, javad, projectId, "Add an English greeting", 120, 2);
    const [crAsk] = await db.select().from(customerApprovals).where(eq(customerApprovals.changeRequestId, cr.id));
    await decideCustomerApproval(db, javad, orgId, crAsk.id, "approved");
    const after = await projectDetail(db, projectId);
    expect(after.project.priceEur).toBe(610);
    expect(after.milestones.map((m) => m.status)).toEqual(["accepted", "ready", "planned"]); // paid before it starts

    const types = (await db.select({ t: events.type }).from(events)).map((e) => e.t);
    expect(types).toEqual(expect.arrayContaining(["order.created", "project.created", "milestone.ready", "milestone.accepted", "milestone.rated", "milestone.started", "milestone.changes", "job.rework", "milestone.revision_cap", "change_request.decided"]));
    const list = await listProjects(db);
    expect(list.kpi.cataloguePct).toBe(1);
    expect(list.rows[0].costEur).toBe(310);
    // the customer's 4 counts with our QA 5s in the partner's quality
    expect((await statsFor(db, pid)).avgQuality).toBeLessThan(5);
  });

  it("closes the project when every milestone is accepted and starts the monthly service", async () => {
    await seedDelivery(db);
    const pid = await partner("luca@example.com");
    const order = await createOrder(db, sys, { packageSlug: "followup-agent", source: "portal", company: "Rossi Srl", email: "rossi@example.com", country: "IT", industry: "installers", locale: "it" });
    const { projectId } = await startOrder(db, javad, order.id);
    await deliverAll(pid, projectId);
    const [p] = await db.select().from(projects).where(eq(projects.id, projectId));
    const [ask] = await db.select().from(customerApprovals).where(eq(customerApprovals.orgId, p.orgId!));
    await decideCustomerApproval(db, javad, p.orgId!, ask.id, "approved");
    const [closed] = await db.select().from(projects).where(eq(projects.id, projectId));
    expect(closed.status).toBe("closed");
    const subs = await db.select().from(subscriptions).where(eq(subscriptions.orgId, p.orgId!));
    expect(subs).toMatchObject([{ product: "followup-agent", monthlyEur: 190 }]);
  });

  it("queues deliveries for a person without the judge, reminds on day 1, 3, 6 and accepts on day 7", async () => {
    await seedDelivery(db);
    const pid = await partner("sara@example.com");
    const order = await createOrder(db, sys, { packageSlug: "lead-crm", source: "market", company: "Verdi Snc", email: "verdi@example.com", country: "IT", industry: "installers" });
    const { projectId } = await startOrder(db, javad, order.id);
    for (const { offer } of await offersFor(db, pid)) await respondOffer(db, sys, pid, offer.id, true);
    const [j] = await db.select().from(jobs).where(eq(jobs.projectId, projectId));
    const dl = await deliver(db, sys, pid, j.id, { link: "https://example.com/w", selfCheck: j.checklist.map(() => true) });
    const q = await qaQueue(db);
    expect(q.map((x) => x.delivery.id)).toEqual([dl.id]);
    expect(q[0].code).toBe("PR-03");
    await humanReview(db, javad, dl.id, j.checklist.map((_, idx) => ({ idx, result: "pass" as const })), 4, "fine");
    const at = (d: number) => new Date(Date.now() + d * 864e5 + 36e5);
    expect(await deliveryWatch(db, at(1))).toMatchObject({ reminded: 1 });
    expect(await deliveryWatch(db, at(1.1))).toMatchObject({ reminded: 0 });
    expect(await deliveryWatch(db, at(3))).toMatchObject({ reminded: 1 });
    expect(await deliveryWatch(db, at(6))).toMatchObject({ reminded: 1, autoAccepted: 0 });
    expect(await deliveryWatch(db, at(7))).toMatchObject({ autoAccepted: 1 });
    const [m] = await db.select().from(milestones).where(eq(milestones.projectId, projectId));
    expect(m).toMatchObject({ status: "accepted", acceptedBy: "auto", reminders: 3 });
    const reminders = (await db.select().from(events).where(eq(events.type, "milestone.reminded"))).map((e) => e.payload.reminder);
    expect(reminders).toEqual([1, 2, 3]);
    expect((await db.select().from(customerApprovals))[0]).toMatchObject({ status: "approved", decidedBy: "system:auto-accept" });
    // the project closed on its own (single milestone): the monthly service runs
    expect((await db.select().from(projects).where(eq(projects.id, projectId)))[0].status).toBe("closed");
  });

  it("versions protocols: drafts need Javad's approval and retire the old version", async () => {
    await seedDelivery(db);
    const [pr] = (await listProtocols(db)).filter((p) => p.protocol.code === "PR-03");
    const v = pr.approved!;
    const draft = await draftVersion(db, javad, pr.protocol.id, { goal: v.goal, inputs: v.inputs, deliverables: v.deliverables, criteria: v.criteria, standardDays: 2, changeNote: "faster" });
    expect((await listProtocols(db)).find((p) => p.protocol.code === "PR-03")!.approved!.version).toBe(1);
    await approveVersion(db, javad, draft.id);
    const now = (await listProtocols(db)).find((p) => p.protocol.code === "PR-03")!;
    expect(now.approved!.version).toBe(2);
    expect(now.versions.find((x) => x.version === 1)!.status).toBe("retired");
  });
});
