import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { auditLog, events } from "@/db/schema";
import {
  addGoal,
  addOutcome,
  addSubscription,
  askCustomerApproval,
  createCustomer,
  createRequest,
  customerOrgFor,
  decideCustomerApproval,
  exportData,
  listServices,
  nextStep,
  results,
  saveTurn,
  threadMessages,
} from "@/server/portal";
import { detectIntent, scriptedReply } from "@/server/portal-chat";
import { useTestDb } from "./helpers";

const db = useTestDb();
const system = { type: "system", id: "test" } as const;
const now = new Date("2026-10-20T12:00:00Z");

async function customer(name = "Rossi Impianti", email = "m@rossi.test") {
  const c = await db.transaction((tx) => createCustomer(tx, system, { name, country: "IT", industry: "installers", locale: "it", baselineEur: 4000, email, contactName: "Marco" }, "a-long-test-password"));
  const sub = await db.transaction((tx) => addSubscription(tx, system, c.org.id, "phone-agent", "Standard", 390, new Date("2026-08-01")));
  return { ...c, sub };
}

describe("customer dashboard", () => {
  it("opens an account with its login and finds the company for the user", async () => {
    const c = await customer();
    expect(c.password).toBe("a-long-test-password");
    const mine = await customerOrgFor(db, c.userId);
    expect(mine?.org.id).toBe(c.org.id);
    expect(mine?.role).toBe("owner");
    const types = (await db.select().from(events)).map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(["customer.created", "subscription.started"]));
  });

  it("compares this month's results with the fee and the starting point", async () => {
    const c = await customer();
    await addOutcome(db, system, { orgId: c.org.id, subscriptionId: c.sub.id, metric: "calls_answered", value: 40, eur: 720, at: new Date("2026-10-05") });
    await addOutcome(db, system, { orgId: c.org.id, metric: "jobs_won", value: 2, eur: 1280, at: new Date("2026-10-09") });
    await addOutcome(db, system, { orgId: c.org.id, metric: "calls_answered", value: 30, eur: 540, at: new Date("2026-09-10") });
    const r = await results(db, c.org.id, now);
    expect(r.month.eur).toBe(2000);
    expect(r.lastMonth.eur).toBe(540);
    expect(r.sinceStart.eur).toBe(2540);
    expect(r.feeEur).toBe(390);
    expect(r.roi).toBe(5.1);
    expect(r.recovered).toBe(0.5);
    expect(r.month.byMetric[0].metric).toBe("jobs_won");
    expect(r.series).toHaveLength(6);
    const s = await listServices(db, c.org.id, "it", now);
    expect(s[0].month).toEqual({ eur: 720, metrics: [{ metric: "calls_answered", value: 40 }] });
  });

  it("refuses unknown metrics and another customer's service", async () => {
    const a = await customer();
    const b = await customer("Bianchi Srl", "b@bianchi.test");
    await expect(addOutcome(db, system, { orgId: a.org.id, metric: "tokens_used", value: 1, eur: 0 })).rejects.toThrow();
    await expect(addOutcome(db, system, { orgId: a.org.id, subscriptionId: b.sub.id, metric: "calls_answered", value: 1, eur: 1 })).rejects.toThrow(/subscription/);
  });

  it("lets only the right customer decide an approval, once, with event and audit", async () => {
    const a = await customer();
    const b = await customer("Bianchi Srl", "b@bianchi.test");
    const ap = await askCustomerApproval(db, system, { orgId: a.org.id, title: "Nuovo messaggio di benvenuto" });
    const user = { type: "user", id: a.userId } as const;
    await expect(decideCustomerApproval(db, user, b.org.id, ap.id, "approved")).rejects.toThrow(/not found/);
    const done = await decideCustomerApproval(db, user, a.org.id, ap.id, "approved");
    expect(done.status).toBe("approved");
    await expect(decideCustomerApproval(db, user, a.org.id, ap.id, "changes")).rejects.toThrow(/already/);
    const ev = await db.select().from(events).where(eq(events.type, "customer_approval.decided"));
    expect(ev[0].payload).toMatchObject({ company: "Rossi Impianti", decision: "approved" });
    expect((await db.select().from(auditLog).where(eq(auditLog.action, "customer_approval.decided"))).length).toBe(1);
  });

  it("understands what the customer asks in four languages", () => {
    expect(detectIntent("Quanto abbiamo recuperato questo mese?")).toBe("results");
    expect(detectIntent("How much did we get back?")).toBe("results");
    expect(detectIntent("Was wartet auf meine Freigabe?")).toBe("approvals");
    expect(detectIntent("چه چیزی منتظر تأیید من است؟")).toBe("approvals");
    expect(detectIntent("Come vanno i nostri obiettivi?")).toBe("goals");
    expect(detectIntent("Il centralino non funziona da ieri")).toBe("support");
    expect(detectIntent("Perdiamo troppo tempo con le fatture dei fornitori")).toBe("billing");
    expect(detectIntent("Perdiamo troppo tempo a rispondere alle email dei clienti")).toBe("problem");
    expect(detectIntent("Cosa conviene risolvere adesso?")).toBe("next");
    expect(detectIntent("ciao")).toBe("help");
  });

  it("answers with cards built from the customer's own data", async () => {
    const c = await customer();
    await addOutcome(db, system, { orgId: c.org.id, metric: "calls_answered", value: 10, eur: 180 });
    const r = await scriptedReply(db, c.org.id, "it", "Quanto abbiamo recuperato questo mese?");
    expect(r.cards[0].type).toBe("results");
    expect(r.text).toContain("180");
    // "I have a new problem" asks first; the next message becomes a confirm card
    const ask = await scriptedReply(db, c.org.id, "it", "Ho un nuovo problema");
    expect(ask.cards).toEqual([]);
    const confirm = await scriptedReply(db, c.org.id, "it", "le email dei clienti restano senza risposta", ask.text);
    expect(confirm.cards).toEqual([{ type: "confirm", kind: "solution", text: "le email dei clienti restano senza risposta" }]);
    const next = await scriptedReply(db, c.org.id, "it", "Cosa conviene risolvere adesso?");
    expect(next.cards[0].type).toBe("next");
    expect((await nextStep(db, c.org.id, "it"))?.product).not.toBe("phone-agent");
  });

  it("keeps each user's conversations to themselves", async () => {
    const a = await customer();
    const b = await customer("Bianchi Srl", "b@bianchi.test");
    const t = await saveTurn(db, a.org.id, a.userId, null, "Quanto abbiamo recuperato?", { text: "…", cards: [] });
    await saveTurn(db, a.org.id, a.userId, t.threadId, "E il mese scorso?", { text: "…", cards: [] });
    const mine = await threadMessages(db, a.org.id, a.userId, t.threadId);
    expect(mine?.messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(await threadMessages(db, b.org.id, b.userId, t.threadId)).toBeNull();
    // a foreign thread id starts a new thread instead of writing into someone else's
    const other = await saveTurn(db, b.org.id, b.userId, t.threadId, "Ciao", { text: "…", cards: [] });
    expect(other.threadId).not.toBe(t.threadId);
  });

  it("creates requests with a Telegram-ready event and exports only the company's own data", async () => {
    const a = await customer();
    const b = await customer("Bianchi Srl", "b@bianchi.test");
    await createRequest(db, { type: "user", id: a.userId }, a.org.id, a.userId, "solution", "Le email dei clienti restano senza risposta");
    await createRequest(db, { type: "user", id: b.userId }, b.org.id, b.userId, "support", "Altro");
    await addGoal(db, system, { orgId: a.org.id, metric: "calls_answered", title: { it: "Nessuna chiamata persa" }, baseline: 60, target: 98, unit: "%" });
    const ev = await db.select().from(events).where(eq(events.type, "customer_request.created"));
    expect(ev.map((e) => e.payload.company).sort()).toEqual(["Bianchi Srl", "Rossi Impianti"]);
    const out = await exportData(db, a.org.id);
    expect(out.requests).toHaveLength(1);
    expect(out.goals).toHaveLength(1);
    expect(out.members.map((m) => m.email)).toEqual(["m@rossi.test"]);
    expect(JSON.stringify(out)).not.toContain("Bianchi");
  });
});
