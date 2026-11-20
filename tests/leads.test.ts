import { describe, expect, it } from "vitest";
import { auditLog, events, leads } from "@/db/schema";
import { captureLead, leadsThisMonth } from "@/server/leads";
import { useTestDb } from "./helpers";

const site = { type: "system", id: "public-site" } as const;
const lead = (over: Record<string, unknown> = {}) => ({
  email: "Mario@Impianti.it",
  industry: "installers",
  country: "it",
  locale: "it-it",
  hook: "scadenzario",
  answers: { work: ["heatpump"] },
  tags: ["heatpump", "all"],
  consent: true,
  consentText: "Acconsento a ricevere email con le scadenze del mio settore.",
  reminders: true,
  ...over,
});

describe("leads", () => {
  const db = useTestDb();

  it("needs explicit consent", async () => {
    await expect(captureLead(db, site, lead({ consent: false }))).rejects.toMatchObject({ code: "invalid" });
    await expect(captureLead(db, site, lead({ website: "spam.example" }))).rejects.toMatchObject({ code: "invalid" });
  });

  it("stores one row per email and hub, and keeps the address out of events", async () => {
    expect(await captureLead(db, site, lead())).toMatchObject({ repeat: false });
    expect(await captureLead(db, site, lead({ tags: ["solar"] }))).toMatchObject({ repeat: true });
    const rows = await db.select().from(leads);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ email: "mario@impianti.it", country: "IT", tags: ["solar"] });
    const evs = await db.select().from(events);
    expect(evs.map((e) => e.type)).toEqual(["lead.captured", "lead.captured"]);
    expect(JSON.stringify(evs) + JSON.stringify(await db.select().from(auditLog))).not.toContain("mario");
    expect((await leadsThisMonth(db)).get("installers-IT")).toBe(1);
  });
});
