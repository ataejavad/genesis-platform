import { describe, expect, it } from "vitest";
import { events, leads } from "@/db/schema";
import { checkupFunnel, checkupIndustries, computeReport, loadCheckupDef, requestCall, startCheckup, unlockCheckup } from "@/server/checkup";
import { loadResearch } from "@/server/hubs";
import { useTestDb } from "./helpers";

const site = { type: "system", id: "public-site" } as const;
const installers = { work: ["heatpump"], team: "m", missedCalls: "mid", jobValue: "mid", office: "mid", incentives: "some", hourly: "mid" };
const ctx = { country: "IT", lang: "it", locale: "it-it", now: new Date("2026-10-23T12:00:00Z") };

describe("check-up engine", () => {
  it("every definition is valid and points at catalogue products and hub deadline tags", () => {
    expect(checkupIndustries().sort()).toEqual(["installers", "metal"]);
    for (const industry of checkupIndustries()) {
      const def = loadCheckupDef(industry)!;
      const tags = new Set(loadResearch().find((r) => r.industry === industry)!.deadlines.flatMap((d) => d.tags));
      const tagOptions = def.questions.filter((q) => q.tags).flatMap((q) => q.options.map((o) => o.id));
      expect(tagOptions.filter((t) => !tags.has(t)), industry).toEqual([]);
    }
  });

  it("each euro amount is the product of the factors it shows", () => {
    const r = computeReport(loadCheckupDef("installers")!, installers, ctx);
    const calls = r.leaks.find((l) => l.id === "missed-calls")!;
    // 10 calls × 25% × €1,200 × 21% sector margin × 46 weeks × 60%
    expect(calls.amount).toBe(Math.round(10 * 0.25 * 1200 * 0.21 * 46 * 0.6));
    expect(calls.factors.map((f) => f.value)).toEqual([10, 0.25, 1200, 0.21, 46, 0.6]);
    expect(r.total).toBe(r.leaks.reduce((s, l) => s + l.amount, 0));
    expect(r.leaks.map((l) => l.amount)).toEqual([...r.leaks.map((l) => l.amount)].sort((a, b) => b - a));
    expect(r.payrollPct).toBeCloseTo((r.total / (12 * 35 * 1720)) * 100, 0);
    expect(r.deadlines.map((d) => d.id)).toContain("fgas-2027");
    expect(r.deadlines[0].url).toMatch(/^\/it-it\/hub\/installers\/it#d-/);
  });

  it("drops leaks that are zero and rejects unanswered questions", () => {
    const r = computeReport(loadCheckupDef("installers")!, { ...installers, incentives: "none" }, ctx);
    expect(r.leaks.map((l) => l.id)).not.toContain("incentive-files");
    expect(() => computeReport(loadCheckupDef("installers")!, { ...installers, hourly: undefined as unknown as string }, ctx)).toThrow();
  });
});

describe("check-up funnel", () => {
  const db = useTestDb();
  const lead = { email: "anna@officina.it", consent: true, consentText: "Acconsento a ricevere il report e offerte per il mio settore.", reminders: false };

  it("keeps the plan locked until email and consent, then counts each step per entrance", async () => {
    const metal = { work: ["import"], team: "m", quotes: "mid", quoteHours: "mid", lost: "mid", followUp: "never", orderValue: "mid", docs: "mid", hourly: "mid" };
    const { id, report } = await startCheckup(db, site, { industry: "metal", country: "it", locale: "it-it", entrance: "home", answers: metal, transcript: [{ role: "user", text: "Facciamo carpenteria e i preventivi ci uccidono" }] });
    expect(report.leaks[0]).not.toHaveProperty("solution");
    await expect(requestCall(db, site, id)).rejects.toMatchObject({ code: "conflict" });
    await expect(unlockCheckup(db, site, id, { ...lead, consent: false })).rejects.toMatchObject({ code: "invalid" });
    const full = await unlockCheckup(db, site, id, lead, async () => "Inizia dai preventivi.");
    expect(full.leaks[0]).toMatchObject({ solution: "drawing-quote" });
    expect(full.advice).toBe("Inizia dai preventivi.");
    expect(await requestCall(db, site, id)).toEqual({ already: false });
    expect(await db.select().from(leads)).toMatchObject([{ email: "anna@officina.it", industry: "metal", hook: "checkup", tags: ["import"] }]);
    expect((await db.select().from(events)).map((e) => e.type)).toEqual(["checkup.completed", "lead.captured", "checkup.unlocked", "checkup.call_requested"]);
    expect(await checkupFunnel(db)).toEqual([{ industry: "metal", entrance: "home", completed: 1, unlocked: 1, calls: 1 }]);
  });
});
