import { describe, expect, it } from "vitest";
import { COMPANY_CRITERIA, COUNTRY_CRITERIA, INDUSTRY_CRITERIA, totalWeight } from "@/server/market-selection/criteria";
import { scoreCompany } from "@/server/market-selection/company-agent";
import { type JsonStat, latestBy, observations } from "@/server/market-selection/eurostat";
import { diagnose } from "@/server/market-selection/funnel";
import { type Outcome, predictiveAccuracy, suggestWeights } from "@/server/market-selection/learning";
import { coverage, SBS_DIVISIONS, spreadToDivisions } from "@/server/market-selection/nace";
import { applies, regulationPressure, urgency, OBLIGATIONS } from "@/server/market-selection/regulations";
import { percentileScore, scoreCandidates } from "@/server/market-selection/score";

describe("criteria", () => {
  it("every level weighs 100 points", () => {
    expect(totalWeight(COUNTRY_CRITERIA)).toBe(100);
    expect(totalWeight(INDUSTRY_CRITERIA)).toBe(100);
    expect(totalWeight(COMPANY_CRITERIA)).toBe(100);
  });
});

describe("scoring", () => {
  it("ranks by percentile and respects direction", () => {
    expect(percentileScore(3, [1, 2, 3], "higher")).toBe(10);
    expect(percentileScore(1, [1, 2, 3], "higher")).toBe(0);
    expect(percentileScore(1, [1, 2, 3], "lower")).toBe(10);
    expect(percentileScore(2, [2, 2], "higher")).toBe(5);
  });

  it("missing values are neutral and lower confidence", () => {
    const crit = [
      { id: "a", label: "a", weight: 60, direction: "higher" as const, source: "" },
      { id: "b", label: "b", weight: 40, direction: "higher" as const, source: "" },
    ];
    const [first, second] = scoreCandidates(crit, [
      { id: "x", name: "X", values: { a: 10, b: 1 } },
      { id: "y", name: "Y", values: { a: 1, b: null } },
    ]);
    expect(first.id).toBe("x");
    expect(first.total).toBe(80); // a = 10/10 × 60; b has a single known value, so neutral 5/10 × 40
    expect(first.confidence).toBe(1);
    expect(second.total).toBe(20); // a = 0, b neutral 5/10 × 40
    expect(second.confidence).toBe(0.6);
  });
});

describe("eurostat JSON-stat", () => {
  const js: JsonStat = {
    id: ["geo", "time"],
    size: [2, 2],
    value: { "0": 1, "1": 2, "3": 4 },
    dimension: {
      geo: { category: { index: { DE: 0, IT: 1 } } },
      time: { category: { index: { "2023": 0, "2024": 1 } } },
    },
  };
  it("decodes the flat index", () => {
    expect(observations(js)).toEqual([
      { at: { geo: "DE", time: "2023" }, value: 1, flag: undefined },
      { at: { geo: "DE", time: "2024" }, value: 2, flag: undefined },
      { at: { geo: "IT", time: "2024" }, value: 4, flag: undefined },
    ]);
  });
  it("keeps the latest period per code", () => {
    const by = latestBy(js, "geo");
    expect(by.get("DE")).toEqual({ value: 2, time: "2024" });
    expect(by.get("IT")).toEqual({ value: 4, time: "2024" });
  });
});

describe("NACE", () => {
  it("maps sections and ranges to divisions", () => {
    expect(coverage("C10-C12")).toEqual([10, 11, 12]);
    expect(coverage("D35-E39")).toEqual([35, 36, 37, 38, 39]);
    expect(coverage("F")).toEqual([41, 42, 43]);
    expect(coverage("C10-S951_X_K")).toBeNull();
  });
  it("uses the narrowest published code", () => {
    const spread = spreadToDivisions(new Map([["C", 10], ["C10-C12", 20]]));
    expect(spread.get("C10")).toEqual({ value: 20, from: "C10-C12" });
    expect(spread.get("C25")).toEqual({ value: 10, from: "C" });
  });
  it("covers the structural business statistics divisions", () => {
    expect(SBS_DIVISIONS).toContain("C25");
    expect(SBS_DIVISIONS).not.toContain("K64");
    expect(SBS_DIVISIONS).not.toContain("O84");
  });
});

describe("regulatory radar", () => {
  const today = new Date("2026-10-23");
  it("urgency peaks just before a deadline", () => {
    expect(urgency("2027-01-01", today)).toBe(1);
    expect(urgency("2030-07-01", today)).toBe(0.2);
    expect(urgency("2026-01-01", today)).toBe(0.7);
  });
  it("NIS2 reaches German machinery makers, not Italian e-invoicing", () => {
    const nis2 = OBLIGATIONS.find((o) => o.id === "de-nis2")!;
    expect(applies(nis2, "DE", "C28")).toBe(true);
    expect(applies(nis2, "DE", "I56")).toBe(false);
    const einv = OBLIGATIONS.find((o) => o.id === "de-einvoice-issue")!;
    expect(applies(einv, "IT", "C28")).toBe(false);
    expect(regulationPressure("DE", "C28", today).obligations).toContain("de-nis2");
  });
  it("every obligation has a source and a check date", () => {
    for (const o of OBLIGATIONS) {
      expect(o.source.length).toBeGreaterThan(5);
      expect(o.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("diagnostic funnel", () => {
  const base = { contacted: 100, replied: 10, interested: 4, meetings: 4, won: 0, daysSinceStart: 30 };
  it("blames the message first", () => {
    expect(diagnose({ ...base, replied: 2 }).fix).toBe("message");
  });
  it("then the offer", () => {
    expect(diagnose({ ...base, interested: 1 }).fix).toBe("offer");
  });
  it("then product or price", () => {
    expect(diagnose({ ...base, meetings: 10, won: 1, daysSinceStart: 60 }).fix).toBe("product-or-price");
  });
  it("waits before judging the industry", () => {
    expect(diagnose(base).fix).toBe("wait");
  });
  it("questions the industry only when every step is healthy", () => {
    expect(diagnose({ ...base, daysSinceStart: 95 }).fix).toBe("industry");
  });
  it("checks unit economics once selling", () => {
    const d = diagnose({ ...base, meetings: 10, won: 3, cacEur: 2000, ltvEur: 4000 });
    expect(d.fix).toBe("product-or-price");
    expect(d.economics.ltvToCac).toBe(2);
  });
});

describe("learning", () => {
  const crit = [
    { id: "good", label: "", weight: 50, direction: "higher" as const, source: "" },
    { id: "noise", label: "", weight: 50, direction: "higher" as const, source: "" },
  ];
  const outcomes: Outcome[] = Array.from({ length: 60 }, (_, i) => {
    const good = i % 10;
    return { score: good * 10, criterionScores: { good, noise: (i * 7) % 10 }, bought: good >= 7 };
  });
  it("measures whether high scores buy more", () => {
    const a = predictiveAccuracy(outcomes);
    expect(a.enough).toBe(true);
    if (a.enough) {
      expect(a.topRate).toBeGreaterThan(a.bottomRate);
      expect(a.recalibrate).toBe(false);
    }
  });
  it("moves weight to the criterion that predicts buying, ±5 max, same total", () => {
    const s = suggestWeights(crit, outcomes)!;
    const good = s.find((x) => x.id === "good")!;
    const noise = s.find((x) => x.id === "noise")!;
    expect(good.to).toBeGreaterThan(good.from);
    expect(noise.to).toBeLessThan(noise.from);
    expect(good.to + noise.to).toBe(100);
    for (const x of s) expect(Math.abs(x.to - x.from)).toBeLessThanOrEqual(5);
  });
  it("waits for 30 outcomes", () => {
    expect(suggestWeights(crit, outcomes.slice(0, 10))).toBeNull();
  });
});

describe("company agent", () => {
  it("scores fit, need and reach", () => {
    const s = scoreCompany(
      { name: "Glas Müller", nace: "C23", staff: 60, hiringRepetitiveRoles: true, affectedByObligation: ["de-einvoice-issue"], consentedEmail: true },
      { nace: ["C23"] },
    );
    expect(s.criterionScores).toEqual({ fit: 10, need: 6, reach: 5 });
    expect(s.total).toBe(74);
  });
});
