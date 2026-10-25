import { asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { contracts, events, invoices, jobs, leads, milestones, notifications, orders, organizations, prospects, subscriptions, user } from "@/db/schema";
import { confirmSignCode, requestSignCode, sendContract } from "@/server/contracts";
import { prospectFromLead, wonToOrder } from "@/server/crm";
import { billNext, billSubscriptions, dunning, epcPayload, issuePaid, markInvoicePaid, payoutBatch, reminderLevel, saveCompany, vatFor } from "@/server/finance";
import { captureLead } from "@/server/leads";
import { confirmLead, createInvite, leadToken, notifyEvent, redeemInvite } from "@/server/notify";
import { applyPartner, decideApplication, offersFor, todayFor } from "@/server/partners";
import { eraseCustomer } from "@/server/privacy";
import { convertOrder, createOrder, createProject, seedDelivery } from "@/server/projects";
import { signContract, signPartner, startOrder, useTestDb } from "./helpers";

const db = useTestDb();
const javad = { type: "user", id: "javad" } as const;
const sys = { type: "system", id: "test" } as const;
const DAY = 864e5;

const order = (over: Record<string, unknown> = {}) => createOrder(db, sys, { packageSlug: "phone-agent", source: "market", company: "Bianchi Impianti", email: "info@bianchi.example", country: "IT", industry: "installers", locale: "it", ...over });
const notifyAll = async () => {
  for (const e of await db.select().from(events).orderBy(asc(events.id))) await notifyEvent(db, e);
};

describe("contract → deposit → project (step 8 gate)", () => {
  it("builds the contract from the package, signs with two codes, and starts the project only when the deposit is paid", async () => {
    await seedDelivery(db);
    const o = await order();
    const { contract: c, password } = await sendContract(db, javad, o.id);
    expect(password.length).toBeGreaterThan(8);
    expect(c).toMatchObject({ kind: "customer", language: "it", jurisdiction: "IT", amountEur: 490, monthlyEur: 390, depositEur: 245, status: "sent", reviewed: false });
    expect(c.body).toContain("Bianchi Impianti");
    expect(c.onerous.length).toBeGreaterThan(2);
    await expect(convertOrder(db, javad, o.id)).rejects.toMatchObject({ code: "not_signed" });
    await expect(sendContract(db, javad, o.id)).rejects.toMatchObject({ code: "already_decided" });

    const signer = { email: "info@bianchi.example", name: "Bianchi", locale: "it" };
    await expect(requestSignCode(db, c.id, "clauses", signer)).rejects.toMatchObject({ code: "sign_first" });
    const { demoCode } = await requestSignCode(db, c.id, "sign", signer, new Date(), () => "111111");
    expect(demoCode).toBe("111111"); // no mailer in tests: shown on screen
    expect(await confirmSignCode(db, c.id, "sign", { code: "222222" }, { signer })).toEqual({ ok: false });
    await expect(confirmSignCode(db, c.id, "sign", { code: "111111" }, { signer: { ...signer, email: "other@x.example" } })).rejects.toMatchObject({ code: "other_signer" });
    expect(await confirmSignCode(db, c.id, "sign", { code: "111111" }, { signer, ip: "1.2.3.4" })).toMatchObject({ ok: true, done: false });
    await requestSignCode(db, c.id, "clauses", signer, new Date(), () => "333333");
    expect(await confirmSignCode(db, c.id, "clauses", { code: "333333" }, { signer })).toMatchObject({ ok: true, done: true });

    const [signed] = await db.select().from(contracts).where(eq(contracts.id, c.id));
    expect(signed.status).toBe("signed");
    expect(signed.evidence).toMatchObject({ ip: "1.2.3.4" });
    expect(signed.evidence?.signedAt && signed.evidence.clausesAt).toBeTruthy();
    const [dep] = await db.select().from(invoices).where(eq(invoices.orderId, o.id));
    expect(dep).toMatchObject({ kind: "deposit", netEur: 245, vatRate: 22, vatEur: 53.9, totalEur: 298.9, status: "requested" });
    expect((await db.select().from(orders).where(eq(orders.id, o.id)))[0].status).toBe("signed");

    // money in: the project starts; no legal number before the business is registered
    await markInvoicePaid(db, javad, dep.id);
    const [after] = await db.select().from(orders).where(eq(orders.id, o.id));
    expect(after).toMatchObject({ status: "converted" });
    expect(after.projectId).toBeTruthy();
    expect((await db.select().from(invoices).where(eq(invoices.id, dep.id)))[0]).toMatchObject({ status: "paid", number: null });
    await saveCompany(db, javad, { legalName: "Legend Partner di Javad", iban: "IT60 X054 2811 1010 0000 0123 456", registered: true });
    expect(await issuePaid(db, javad)).toBe(1);
    expect((await db.select().from(invoices).where(eq(invoices.id, dep.id)))[0]).toMatchObject({ status: "issued", number: `${new Date().getUTCFullYear()}/0001` });
    const types = (await db.select().from(events)).map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(["contract.sent", "contract.signed", "invoice.requested", "invoice.paid", "invoice.issued", "project.created"]));
    // a returning buyer orders again: same company, no second account
    const again = await sendContract(db, javad, (await order()).id);
    expect(again.password).toBe("");
    expect(again.orgId).toBe(signed.orgId);
    // the signing code never travels in an event (n8n receives events)
    expect(JSON.stringify((await db.select().from(events)).map((e) => e.payload))).not.toContain("333333");
  });

  it("bills each milestone before it starts, monthly fees once per month, and reminds by date", async () => {
    await seedDelivery(db);
    const o = await order();
    const { projectId } = await startOrder(db, javad, o.id);
    const ms = await db.select().from(milestones).where(eq(milestones.projectId, projectId)).orderBy(asc(milestones.seq));
    // the deposit paid the first milestone; the second waits, and so do its tasks
    expect(ms.map((m) => [m.status, m.amountEur])).toEqual([["open", 245], ["planned", 245]]);
    expect((await db.select().from(jobs).where(eq(jobs.milestoneId, ms[1].id))).map((j) => j.status)).toEqual(["held"]);
    expect(await billNext(db, projectId)).toBeNull(); // nothing to bill while the first one runs
    await db.update(milestones).set({ status: "accepted" }).where(eq(milestones.id, ms[0].id));
    const inv = await billNext(db, projectId);
    expect(inv).toMatchObject({ kind: "milestone", netEur: 245, milestoneId: ms[1].id });
    expect(await billNext(db, projectId)).toBeNull(); // once
    expect((await db.select().from(milestones).where(eq(milestones.id, ms[1].id)))[0].status).toBe("unpaid");
    // paid late: it starts now and its dates move by the wait
    const late = new Date(Date.now() + 20 * DAY);
    await markInvoicePaid(db, javad, inv!.id, late);
    const [m1] = await db.select().from(milestones).where(eq(milestones.id, ms[1].id));
    expect(m1.status).toBe("open");
    expect(m1.dueAt!.getTime()).toBeGreaterThan(late.getTime());
    const [j1] = await db.select().from(jobs).where(eq(jobs.milestoneId, ms[1].id));
    expect(["open", "offered"]).toContain(j1.status);
    expect(j1.dueAt.getTime()).toBeGreaterThan(late.getTime());

    const [org] = await db.select().from(organizations).where(eq(organizations.name, "Bianchi Impianti"));
    await db.insert(subscriptions).values({ orgId: org.id, product: "phone-agent", plan: "standard", monthlyEur: 390, startedAt: new Date(Date.now() - DAY) });
    expect(await billSubscriptions(db)).toBe(1);
    expect(await billSubscriptions(db)).toBe(0);

    const now = new Date();
    expect(reminderLevel(new Date(now.getTime() + 2 * DAY), new Date(now.getTime() - 12 * DAY), now)).toBe(1);
    expect(reminderLevel(new Date(now.getTime() - 8 * DAY), new Date(now.getTime() - 22 * DAY), now)).toBe(3);
    expect(await dunning(db, new Date(now.getTime() + 30 * DAY))).toBe(1);
    expect(await dunning(db, new Date(now.getTime() + 30 * DAY))).toBe(0);
    const reminded = (await db.select().from(events).where(eq(events.type, "invoice.reminded"))).map((e) => e.payload.level);
    expect(reminded).toEqual([4]);
  });

  it("applies the VAT rule of the country pack and builds the bank QR payload", () => {
    expect(vatFor("IT", null, "it")).toEqual({ rate: 22, note: null });
    expect(vatFor("DE", "DE123456789", "de").rate).toBe(0);
    expect(vatFor("DE", "DE123456789", "de").note).toContain("196");
    expect(vatFor("DE", null, "de").rate).toBe(22);
    expect(vatFor("CH", null, "en")).toMatchObject({ rate: 0 });
    expect(epcPayload({ legalName: "LP", iban: "IT60X0542811101000000123456", bic: null }, { totalEur: 358.68, reference: "LP-ABC" })?.split("\n")).toEqual(["BCD", "002", "1", "SCT", "", "LP", "IT60X0542811101000000123456", "EUR358.68", "", "", "LP-ABC"]);
    expect(epcPayload({ legalName: "LP", iban: null, bic: null }, { totalEur: 1, reference: "x" })).toBeNull();
  });
});

describe("partners sign the framework before any offer", () => {
  it("offers work only after signing, flags false self-employment answers, and pays by SEPA file", async () => {
    await seedDelivery(db);
    const a = await applyPartner(db, { kind: "person", name: "Anna Neri", email: "anna@example.com", country: "IT", languages: ["it", "en"], skills: ["automation", "crm", "ai-setup"], consent: true });
    await decideApplication(db, javad, a.id, true, "a-long-test-password");
    const [fw] = await db.select().from(contracts).where(eq(contracts.partnerId, a.id));
    expect(fw).toMatchObject({ kind: "partner", status: "sent" });
    expect(fw.body).toMatch(/riservatezza|confidential/i);
    expect((await todayFor(db, a.id))[0]).toMatchObject({ kind: "contract", href: `/partner/contract/${fw.id}` });

    const o = await order();
    await startOrder(db, javad, o.id);
    expect(await offersFor(db, a.id)).toHaveLength(0); // not signed: no offers

    await signContract(db, fw.id, "anna@example.com", { ownHours: true, otherClients: false, ownTools: true });
    const [ev] = await db.select().from(events).where(eq(events.type, "contract.signed"));
    const flags = (await db.select().from(events).where(eq(events.type, "contract.signed"))).find((e) => e.payload.kind === "partner")?.payload.independenceFlags;
    expect(ev).toBeTruthy();
    expect(flags).toEqual(["otherClients"]);

    // payouts: a SEPA file only with our IBAN and theirs
    expect((await payoutBatch(db)).xml).toBeNull();
  });

  it("writes a valid pain.001 batch for due payouts with an IBAN", async () => {
    const a = await applyPartner(db, { kind: "person", name: "Luca <Bianchi>", email: "luca@example.com", country: "IT", languages: ["it"], skills: ["automation"], consent: true });
    await decideApplication(db, javad, a.id, true, "a-long-test-password");
    await signPartner(db, a.id);
    const { setPartnerIban } = await import("@/server/partners");
    await expect(setPartnerIban(db, javad, a.id, { iban: "123", billingName: "Luca" })).rejects.toBeTruthy();
    await setPartnerIban(db, javad, a.id, { iban: "IT60 X054 2811 1010 0000 0123 456", billingName: "Luca <Bianchi>" });
    await saveCompany(db, javad, { legalName: "Legend Partner", iban: "IT02A0301503200000003517230" });
    const { payouts } = await import("@/db/schema");
    await db.insert(payouts).values({ partnerId: a.id, amountEur: 120, status: "due", dueAt: new Date() });
    const b = await payoutBatch(db);
    expect(b.ids).toHaveLength(1);
    expect(b.xml).toContain("pain.001.001.09");
    expect(b.xml).toContain("<CtrlSum>120.00</CtrlSum>");
    expect(b.xml).toContain("Luca &lt;Bianchi&gt;");
  });
});

describe("notifications, invites, leads, CRM, erasure", () => {
  it("turns events into messages in the person's language, and invites set a password by link", async () => {
    await seedDelivery(db);
    const o = await order();
    await sendContract(db, javad, o.id);
    await notifyAll();
    await notifyAll(); // once per event and template
    const mails = await db.select().from(notifications).orderBy(asc(notifications.createdAt));
    expect(mails.map((m) => m.template).sort()).toEqual(["contract", "invite"]);
    expect(mails.every((m) => m.locale === "it" && m.email === "info@bianchi.example")).toBe(true);
    expect(mails.find((m) => m.template === "contract")!.body).toContain("/portal/contract/");
    expect(mails.find((m) => m.template === "invite")!.body).not.toMatch(/password[:=]\s*\S{8,}/i);

    const [u] = await db.select().from(user).where(eq(user.email, "info@bianchi.example"));
    const link = await createInvite(db, u.id);
    const token = new URL(link).searchParams.get("token")!;
    await expect(redeemInvite(db, token, "short")).rejects.toMatchObject({ code: "weak_password" });
    expect(await redeemInvite(db, token, "a-very-long-password")).toEqual({ email: "info@bianchi.example", next: "/portal/login" });
    await expect(redeemInvite(db, token, "a-very-long-password")).rejects.toMatchObject({ code: "invalid_link" });
  });

  it("confirms leads by link into the CRM, turns a won deal into an order, and erases personal data but keeps invoices", async () => {
    await seedDelivery(db);
    await captureLead(db, { type: "system", id: "public-site" }, { email: "mario@impianti.it", industry: "installers", country: "it", locale: "it-it", hook: "scadenzario", answers: { company: "Impianti Mario" }, tags: ["all"], consent: true, consentText: "Acconsento.", reminders: true });
    const [l] = await db.select().from(leads);
    await notifyAll();
    expect((await db.select().from(notifications))[0]).toMatchObject({ template: "leadConfirm", audience: "lead" });
    await expect(confirmLead(db, l.id, "wrong")).rejects.toMatchObject({ code: "invalid_link" });
    await confirmLead(db, l.id, leadToken(l.id));
    await confirmLead(db, l.id, leadToken(l.id)); // idempotent
    expect((await db.select().from(events).where(eq(events.type, "lead.confirmed")))).toHaveLength(1);
    const pid = await db.transaction((tx) => prospectFromLead(tx, sys, l.id));
    expect((await db.select().from(prospects).where(eq(prospects.id, pid!)))[0]).toMatchObject({ name: "Impianti Mario", source: "hub" });

    const o = await wonToOrder(db, javad, pid!, "phone-agent");
    expect(o).toMatchObject({ source: "crm", email: "mario@impianti.it", status: "new" });
    expect((await db.select().from(prospects).where(eq(prospects.id, pid!)))[0].stage).toBe("won");
    const { contractId } = await startOrder(db, javad, o.id);

    const [org] = await db.select().from(organizations).where(eq(organizations.name, "Impianti Mario"));
    const r = await eraseCustomer(db, javad, org.id);
    expect(r.people).toBe(1);
    expect((await db.select().from(user).where(eq(user.email, "mario@impianti.it")))).toHaveLength(0);
    expect((await db.select().from(leads))).toHaveLength(0);
    expect((await db.select().from(invoices).where(eq(invoices.orgId, org.id)))).toHaveLength(1);
    expect((await db.select().from(contracts).where(eq(contracts.id, contractId)))[0].status).toBe("signed");
    // an internal project (no customer) still starts directly
    expect((await createProject(db, javad, { orgId: null, packageSlug: "phone-agent" })).code).toMatch(/^P-/);
  });
});
