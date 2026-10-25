import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { Candidate, ScoutInput } from "@/agents/ai-scout";
import { lessons } from "@/db/schema";
import { aiScout } from "@/server/ai-scout";
import { seedDelivery } from "@/server/projects";
import { useTestDb } from "./helpers";

const db = useTestDb();

const cand = (name: string): Candidate => ({ name, url: "https://example.com/tool", released: "2026-10-20", kind: "step", replaces: "invoice.mark_paid", what: "Matches bank transfers to invoices.", costEurMonth: 9, savesEurMonth: 120, risk: "EU hosting available", confidence: "medium" });

describe("AI scout", () => {
  it("files new candidates as switched-off proposals and never repeats one", async () => {
    await seedDelivery(db);
    let seen: ScoutInput | null = null;
    const find = async (i: ScoutInput) => ((seen = i), [cand("BankMatch"), cand("VoiceDesk")]);
    expect(await aiScout(db, new Date(), find)).toEqual({ candidates: 2, savesEurMonth: 240 });
    // the scout is told which steps a person still does and how we plan to hand them over
    expect(seen!.humanSteps.find((s) => s.id === "invoice.mark_paid")?.agentHow).toMatch(/PSD2/);
    expect(seen!.packages.length).toBeGreaterThan(0);
    const rows = await db.select().from(lessons).where(eq(lessons.area, "ai-scout"));
    expect(rows.map((r) => r.active)).toEqual([false, false]);
    const again = await aiScout(db, new Date(), async (i) => (expect(i.known).toContain("BankMatch"), [cand("bankmatch")]));
    expect(again.candidates).toBe(0);
  });
});
