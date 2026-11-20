import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { pool } from "@/agents/outbound";
import { mockAdminChat } from "@/providers/admin-chat";
import type { CompanySearch } from "@/providers/company-search";
import { apifyMaps } from "@/providers/company-search/apify";
import { setLlmForTests } from "@/providers/llm";
import { auditLog, events, prospects, touches } from "@/db/schema";
import { decideFilter } from "@/server/market-filters";
import { findCustomers } from "@/server/outbound-run";
import { useTestDb } from "./helpers";

const javad = { type: "user", id: "javad" } as const;

// a Google Maps search that answers like Apify, with one closed place and one duplicate across searches
const maps = (): CompanySearch & { calls: string[] } => {
  const calls: string[] = [];
  return {
    provider: "fake-maps", eurPerResult: 0.004, calls,
    async search({ term, region }) {
      calls.push(`${term}|${region}`);
      return [
        { name: `Termoidraulica ${term.slice(0, 6)} Srl`, city: "Milano", region, website: `https://${term.replace(/\W/g, "")}.it`, phone: "+39 02 111", rating: 3.6, reviews: 25, mapsUrl: "https://maps.google.com/?cid=1" },
        { name: "Impianti Bianchi Snc", city: "Bergamo", region, website: "https://impiantibianchi.it", phone: "+39 035 222" },
        { name: "Chiuso Srl", city: "Monza", region, closed: true },
      ];
    },
  };
};

describe("first real customer search from the cockpit", () => {
  const db = useTestDb();

  it("finds, scores and saves companies as drafts only, then tells Javad once", async () => {
    const finder = maps();
    const chat = mockAdminChat();
    const s = await findCustomers(db, javad, { industry: "installers", region: "Lombardia", limit: 10 }, { finder, people: null, research: false, adminChat: chat });
    // one search per term in the one region asked for
    expect(finder.calls).toHaveLength(3);
    expect(finder.calls.every((c) => c.endsWith("|Lombardia"))).toBe(true);
    expect(s.added).toBe(4); // 3 own names + Bianchi once; the closed one is dropped
    expect(s.found).toBe(6);
    const rows = await db.select().from(prospects);
    expect(rows.map((r) => r.name)).toContain("Impianti Bianchi Snc");
    expect(rows.every((r) => r.country === "IT" && r.source === "maps")).toBe(true);
    // nothing leaves without Javad: every touch is a draft or parked, none approved
    const t = await db.select().from(touches);
    expect(t.length).toBeGreaterThan(0);
    expect(t.some((x) => x.status === "approved")).toBe(false);
    // cold email in Italy stays parked (no consent, switch off)
    expect(t.filter((x) => x.channel === "email").every((x) => x.blockedReason)).toBe(true);
    expect((await db.select().from(events).where(eq(events.type, "outbound.run_finished"))).length).toBe(1);
    expect((await db.select().from(auditLog).where(eq(auditLog.action, "outbound.run_finished"))).length).toBe(1);
    expect(chat.sent).toHaveLength(1);
    expect(chat.sent[0].link).toContain("/cockpit/outreach");

    // a second run finds the same firms: no duplicates, no new alert
    const again = await findCustomers(db, javad, { industry: "installers", region: "Lombardia", limit: 10 }, { finder: maps(), people: null, research: false, adminChat: chat });
    expect(again.added).toBe(0);
    expect(again.duplicates).toBe(4);
    expect(chat.sent).toHaveLength(1);
  });

  it("respects a market Javad paused, the run cap and unknown input", async () => {
    await decideFilter(db, javad, "IT", "F43.22", false);
    const finder = maps();
    const s = await findCustomers(db, javad, { industry: "installers", limit: 10 }, { finder, people: null, research: false });
    expect(finder.calls).toHaveLength(0);
    expect(s.skipped[0]).toContain("paused");
    await expect(findCustomers(db, javad, { industry: "bakeries", limit: 5 }, { finder, people: null, research: false })).rejects.toThrow(/unknown market/);
    await expect(findCustomers(db, javad, { industry: "metal", region: "Sicilia", limit: 5 }, { finder, people: null, research: false })).rejects.toThrow(/unknown region/);
    await expect(findCustomers(db, javad, { industry: "metal", limit: 5 }, { finder: null, people: null, research: false })).rejects.toThrow(/APIFY_TOKEN/);
  });

  it("past the time budget the rest gets the template line instead of research", async () => {
    const s = await findCustomers(db, javad, { industry: "metal", region: "Veneto", limit: 3 }, { finder: maps(), people: null, research: true, budgetMs: -1 });
    expect(s.researched).toBe(0);
    expect(s.added).toBeGreaterThan(0);
  });

  it("pool keeps order and limits parallel work", async () => {
    let live = 0;
    let peak = 0;
    const out = await pool([1, 2, 3, 4, 5], 2, async (x) => {
      live++;
      peak = Math.max(peak, live);
      await new Promise((r) => setTimeout(r, 5));
      live--;
      return x * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10]);
    expect(peak).toBe(2);
  });
});

describe("Maps listings as they really come", () => {
  const db = useTestDb();

  it("null fields from Apify do not fail the save, and keyword titles become business names", async () => {
    const rows = [
      { title: "TERMOIDRAULICA TRISCARI SRL", city: null, website: null, phone: "+39 02 1", state: "Lombardia", totalScore: null, reviewsCount: null, url: null, permanentlyClosed: false },
      { title: "CONDIZIONATORI BRESCIA ❄️ Installazione Climatizzatori", city: "Brescia", website: "https://cb.it", phone: null, state: null },
      { title: "Impianti fotovoltaici pavia - Elettronica Pavese", city: "Pavia", website: "https://ep.it", phone: "+39 0382 1" },
    ];
    const finder = apifyMaps("t", (async () => new Response(JSON.stringify(rows))) as unknown as typeof fetch);
    const s = await findCustomers(db, javad, { industry: "installers", region: "Lombardia", limit: 10 }, { finder, people: null, research: false });
    expect(s.failed).toBe(0);
    expect(s.errors).toEqual([]);
    expect((await db.select().from(prospects)).map((p) => p.name).sort()).toEqual(["Condizionatori Brescia", "Elettronica Pavese", "Termoidraulica Triscari Srl"]);
  });

  it("a failed research shows its reason in the result", async () => {
    const finder = apifyMaps("t", (async () => new Response(JSON.stringify([{ title: "Rossi Impianti Srl", city: "Milano", website: "https://rossi.it", phone: "+39 02 9" }]))) as unknown as typeof fetch);
    setLlmForTests({ provider: "fake", model: "fake", webSearch: true, complete: async () => { throw new Error("gemini 429: quota"); } });
    try {
      const s = await findCustomers(db, javad, { industry: "installers", region: "Lombardia", limit: 3 }, { finder, people: null, research: true });
      expect(s.added).toBe(1);
      expect(s.errors[0]).toContain("gemini 429");
    } finally {
      setLlmForTests(null);
    }
  });
});
