import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { approvals, events, jobOffers, jobs, payouts, prospects, touches } from "@/db/schema";
import { createDraft } from "@/server/content";
import { opsWatch } from "@/server/ops-watch";
import { addDocument, applyPartner, checkDocument, decideApplication, offersFor, respondOffer } from "@/server/partners";
import { createOrder, seedDelivery } from "@/server/projects";
import { signPartner, startOrder, useTestDb } from "./helpers";

const db = useTestDb();
const javad = { type: "user", id: "javad" } as const;
const sys = { type: "system", id: "test" } as const;
const HOUR = 36e5;

async function partner(name: string, email: string) {
  const a = await applyPartner(db, { kind: "person", name, email, country: "IT", languages: ["it", "en"], skills: ["automation", "crm", "ai-setup"], consent: true });
  await decideApplication(db, javad, a.id, true, "a-long-test-password");
  await signPartner(db, a.id);
  await checkDocument(db, javad, (await addDocument(db, javad, a.id, "dpa", "https://example.com/dpa.pdf")).id, true);
  return a.id;
}

async function project() {
  await seedDelivery(db);
  const o = await createOrder(db, sys, { packageSlug: "followup-agent", source: "portal", company: "Rossi Srl", email: "rossi@example.com", country: "IT", industry: "installers", locale: "it" });
  return (await startOrder(db, javad, o.id)).projectId;
}

const digests = async () => (await db.select().from(events).where(eq(events.type, "ops.flagged"))).map((e) => e.payload.items as { kind: string; key: string }[]);

describe("ops watchdog", () => {
  it("flags project tasks no partner can take, once a day, and offers them when a partner joins", async () => {
    const projectId = await project();
    const r1 = await opsWatch(db);
    expect(r1.counts.no_match).toBeGreaterThan(0);
    await opsWatch(db);
    expect((await digests()).length).toBe(1); // not repeated within the day
    const anna = await partner("Anna", "anna@x.test");
    const r2 = await opsWatch(db);
    expect(r2.reoffered).toBeGreaterThan(0);
    expect((await offersFor(db, anna)).length).toBeGreaterThan(0);
    const open = await db.select().from(jobs).where(eq(jobs.projectId, projectId));
    expect(open.every((j) => j.status === "offered")).toBe(true);
  });

  it("re-offers a declined job and expires offers nobody answered", async () => {
    const anna = await partner("Anna", "anna@x.test");
    await project();
    const [first] = await offersFor(db, anna);
    await respondOffer(db, sys, anna, first.offer.id, false);
    const bruno = await partner("Bruno", "bruno@x.test");
    await opsWatch(db);
    expect((await offersFor(db, bruno)).map((o) => o.job.id)).toContain(first.job.id);
    // two days later nobody answered: Bruno's offers expire, nobody else matches, the job is flagged
    await opsWatch(db, new Date(Date.now() + 49 * HOUR));
    const expired = await db.select().from(jobOffers).where(eq(jobOffers.partnerId, bruno));
    expect(expired.every((o) => o.status === "expired")).toBe(true);
    expect((await digests()).flat().some((i) => i.key === `no_match:${first.job.id}`)).toBe(true);
  });

  it("warns about payouts due and overdue", async () => {
    const anna = await partner("Anna", "anna@x.test");
    await db.insert(payouts).values({ partnerId: anna, amountEur: 300, dueAt: new Date(Date.now() - HOUR) });
    const r = await opsWatch(db);
    expect(r.counts.payout).toBe(1);
  });

  it("reminds Javad of outbound first messages and content drafts that wait too long, once a day", async () => {
    const [p] = await db.insert(prospects).values({ key: "rossi.it", name: "Rossi", industry: "installers", country: "IT", source: "maps" }).returning();
    await db.insert(touches).values({ prospectId: p.id, step: "linkedin-1", position: 0, channel: "linkedin", locale: "it-it", body: "b", dueAt: new Date() });
    await createDraft(db, sys, { locale: "en-gb", slug: "test/wait", title: "Wait", summary: "s", body: "b" });
    expect((await opsWatch(db)).counts.outbound).toBeUndefined(); // fresh: not yet
    const old = new Date(Date.now() - 80 * HOUR);
    await db.update(touches).set({ createdAt: old });
    await db.update(approvals).set({ createdAt: old });
    const r = await opsWatch(db);
    expect(r.counts).toMatchObject({ outbound: 1, draft: 1 });
    expect(r.items.find((i) => i.kind === "outbound")?.text).toMatch(/^1 company waits/);
    expect((await opsWatch(db)).flagged).toBe(0); // not repeated the same day
  });
});
