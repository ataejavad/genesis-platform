import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { events, jobOffers, jobs, payouts } from "@/db/schema";
import { opsWatch } from "@/server/ops-watch";
import { addDocument, applyPartner, checkDocument, decideApplication, offersFor, respondOffer } from "@/server/partners";
import { convertOrder, createOrder, seedDelivery } from "@/server/projects";
import { useTestDb } from "./helpers";

const db = useTestDb();
const javad = { type: "user", id: "javad" } as const;
const sys = { type: "system", id: "test" } as const;
const HOUR = 36e5;

async function partner(name: string, email: string) {
  const a = await applyPartner(db, { kind: "person", name, email, country: "IT", languages: ["it", "en"], skills: ["automation", "crm", "ai-setup"], consent: true });
  await decideApplication(db, javad, a.id, true, "a-long-test-password");
  await checkDocument(db, javad, (await addDocument(db, javad, a.id, "dpa", "https://example.com/dpa.pdf")).id, true);
  return a.id;
}

async function project() {
  await seedDelivery(db);
  const o = await createOrder(db, sys, { packageSlug: "followup-agent", source: "portal", company: "Rossi Srl", email: "rossi@example.com", country: "IT", industry: "installers", locale: "it" });
  return (await convertOrder(db, javad, o.id)).projectId;
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
});
