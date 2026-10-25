import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { customerApprovals, events, jobs, milestones, projects, subscriptions } from "@/db/schema";
import { health, qaRoute, riskOf } from "@/server/delivery-rules";
import { addDocument, applyPartner, checkDocument, decideApplication, deliver, offersFor, respondOffer } from "@/server/partners";
import { decideCustomerApproval } from "@/server/portal";
import {
  approveVersion,
  convertOrder,
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
import { useTestDb } from "./helpers";

const db = useTestDb();
const javad = { type: "user", id: "javad" } as const;
const sys = { type: "system", id: "test" } as const;

async function partner(email: string) {
  const a = await applyPartner(db, { kind: "person", name: "Anna Neri", email, country: "IT", languages: ["it", "en"], skills: ["automation", "crm", "ai-setup"], consent: true });
  await decideApplication(db, javad, a.id, true, "a-long-test-password");
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
    const { projectId, password } = await convertOrder(db, javad, order.id);
    expect(password.length).toBeGreaterThan(8);
    const d = await projectDetail(db, projectId);
    expect(d.project).toMatchObject({ code: "P-1001", risk: "low", priceEur: 490, monthlyEur: 390, budgetEur: 310, language: "it" });
    expect(d.milestones.map((m) => m.amountEur)).toEqual([294, 196]);
    // tasks carry the protocol's criteria in the customer's language, white-label code, and went out as offers
    expect(d.tasks[0].job.checklist[0]).toBe("L'assistente dice di essere un'AI nella prima frase");
    expect(d.tasks[0].job.customerCode).toMatch(/^C-.{4} · installers · IT$/);
    expect(d.tasks.every((t) => t.job.status === "offered")).toBe(true);

    await deliverAll(pid, projectId);
    // first milestone done → the customer is asked; second still open
    let ms = await db.select().from(milestones).where(eq(milestones.projectId, projectId));
    expect(ms.map((m) => m.status).sort()).toEqual(["ready", "ready"]);
    const orgId = d.project.orgId ?? (await db.select().from(projects).where(eq(projects.id, projectId)))[0].orgId!;
    const asks = await db.select().from(customerApprovals).where(eq(customerApprovals.orgId, orgId));
    expect(asks).toHaveLength(2);
    expect((await customerProjects(db, orgId))[0]).toMatchObject({ code: "P-1001", progress: 1 });

    // one approved, one sent back, then approved
    await decideCustomerApproval(db, javad, orgId, asks[0].id, "approved");
    await decideCustomerApproval(db, javad, orgId, asks[1].id, "changes", "the greeting is too long");
    ms = await db.select().from(milestones).where(eq(milestones.projectId, projectId));
    expect(ms.map((m) => m.status).sort()).toEqual(["accepted", "changes"]);
    expect((await db.select().from(projects).where(eq(projects.id, projectId)))[0].status).toBe("running");

    // a change request is priced and needs the customer's yes; then it is part of the project
    const cr = await quoteChange(db, javad, projectId, "Add an English greeting", 120, 2);
    const [crAsk] = await db.select().from(customerApprovals).where(eq(customerApprovals.changeRequestId, cr.id));
    await decideCustomerApproval(db, javad, orgId, crAsk.id, "approved");
    const after = await projectDetail(db, projectId);
    expect(after.project.priceEur).toBe(610);
    expect(after.milestones).toHaveLength(3);

    const types = (await db.select({ t: events.type }).from(events)).map((e) => e.t);
    expect(types).toEqual(expect.arrayContaining(["order.created", "project.created", "milestone.ready", "milestone.accepted", "milestone.changes", "change_request.decided"]));
    const list = await listProjects(db);
    expect(list.kpi.cataloguePct).toBe(1);
    expect(list.rows[0].costEur).toBe(310);
  });

  it("closes the project when every milestone is accepted and starts the monthly service", async () => {
    await seedDelivery(db);
    const pid = await partner("luca@example.com");
    const order = await createOrder(db, sys, { packageSlug: "followup-agent", source: "portal", company: "Rossi Srl", email: "rossi@example.com", country: "IT", industry: "installers", locale: "it" });
    const { projectId } = await convertOrder(db, javad, order.id);
    await deliverAll(pid, projectId);
    const [p] = await db.select().from(projects).where(eq(projects.id, projectId));
    const [ask] = await db.select().from(customerApprovals).where(eq(customerApprovals.orgId, p.orgId!));
    await decideCustomerApproval(db, javad, p.orgId!, ask.id, "approved");
    const [closed] = await db.select().from(projects).where(eq(projects.id, projectId));
    expect(closed.status).toBe("closed");
    const subs = await db.select().from(subscriptions).where(eq(subscriptions.orgId, p.orgId!));
    expect(subs).toMatchObject([{ product: "followup-agent", monthlyEur: 190 }]);
  });

  it("queues deliveries for a person without the judge, and reminds customers after 24 hours", async () => {
    await seedDelivery(db);
    const pid = await partner("sara@example.com");
    const order = await createOrder(db, sys, { packageSlug: "lead-crm", source: "market", company: "Verdi Snc", email: "verdi@example.com", country: "IT", industry: "installers" });
    const { projectId } = await convertOrder(db, javad, order.id);
    for (const { offer } of await offersFor(db, pid)) await respondOffer(db, sys, pid, offer.id, true);
    const [j] = await db.select().from(jobs).where(eq(jobs.projectId, projectId));
    const dl = await deliver(db, sys, pid, j.id, { link: "https://example.com/w", selfCheck: j.checklist.map(() => true) });
    const q = await qaQueue(db);
    expect(q.map((x) => x.delivery.id)).toEqual([dl.id]);
    expect(q[0].code).toBe("PR-03");
    await humanReview(db, javad, dl.id, j.checklist.map((_, idx) => ({ idx, result: "pass" as const })), 4, "fine");
    expect(await deliveryWatch(db, new Date(Date.now() + 2 * 864e5))).toMatchObject({ reminded: 1 });
    expect(await deliveryWatch(db, new Date(Date.now() + 2 * 864e5 + 36e5))).toMatchObject({ reminded: 0 });
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
