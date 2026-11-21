import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { pool } from "@/agents/outbound";
import { mockAdminChat } from "@/providers/admin-chat";
import type { CompanySearch } from "@/providers/company-search";
import { apifyMaps } from "@/providers/company-search/apify";
import { setLlmForTests } from "@/providers/llm";
import { auditLog, events, prospects, touches } from "@/db/schema";
import { decideFilter } from "@/server/market-filters";
import { findCustomers, researchBacklog, researchWaiting } from "@/server/outbound-run";
import { approveSequence } from "@/server/outreach";
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
    // not a quota error: a 429 would make research read the (real) website instead, which tests must not fetch
    setLlmForTests({ provider: "fake", model: "fake", webSearch: true, complete: async () => { throw new Error("gemini 500: internal"); } });
    try {
      const s = await findCustomers(db, javad, { industry: "installers", region: "Lombardia", limit: 3 }, { finder, people: null, research: true });
      expect(s.added).toBe(1);
      expect(s.errors[0]).toContain("gemini 500");
    } finally {
      setLlmForTests(null);
    }
  });
});

describe("research later, when the free AI quota is back", () => {
  const db = useTestDb();
  const research = { facts: [{ text: "Installa pompe di calore dal 2005", source: { name: "sito", url: "https://rossi.it" } }], persona: { summary: "Impiantista a Milano.", offers: ["Pompe di calore"], customers: null, pains: [{ text: "Telefonate perse", why: "recensioni" }], questions: ["Quante chiamate perdete?"] }, personal: { local: "Ho visto che installate pompe di calore dal 2005.", fa: "دیدم از ۲۰۰۵ پمپ حرارتی نصب می‌کنید." }, costEur: 0.01 };
  const rows = [{ title: "ROSSI IMPIANTI ❄️ Climatizzatori Milano", city: "Milano", website: "https://rossi.it", phone: "+39 02 9" }, { title: "Bianchi Termo Srl", city: "Monza", website: "https://bianchi.it", phone: "+39 039 1" }];
  const finder = () => apifyMaps("t", (async () => new Response(JSON.stringify(rows))) as unknown as typeof fetch);

  it("rewrites the drafts with the personal line, cleans old names, and stops on a quota error", async () => {
    await findCustomers(db, javad, { industry: "installers", region: "Lombardia", limit: 5 }, { finder: finder(), people: null, research: false });
    // a company saved before names were cleaned
    await db.update(prospects).set({ name: "BIANCHI TERMO SRL ❄️ Caldaie" }).where(eq(prospects.website, "https://bianchi.it"));
    let calls = 0;
    const first = await researchBacklog(db, javad, { run: async () => (++calls === 1 ? research : Promise.reject(new Error("gemini 429: You exceeded your current quota"))) });
    expect(first.researched).toBe(1);
    expect(first.stopped).toContain("429");
    expect(first.waiting).toBe(1);
    const done = (await db.select().from(prospects)).find((p) => (p.signals as Record<string, unknown>).researched);
    const t = await db.select().from(touches).where(eq(touches.prospectId, done!.id));
    expect(t.some((x) => x.body.includes("pompe di calore dal 2005"))).toBe(true);
    expect(t.some((x) => x.status === "approved")).toBe(false);

    const second = await researchBacklog(db, javad, { run: async () => research });
    expect(second.researched).toBe(1);
    expect(second.waiting).toBe(0);
    expect((await db.select().from(prospects)).map((p) => p.name).sort()).toEqual(["Bianchi Termo Srl", "Rossi Impianti"]);
    expect(await researchWaiting(db)).toBe(0);
  });

  it("a company without a website does not stop the others when web search has no quota", async () => {
    await findCustomers(db, javad, { industry: "installers", region: "Lombardia", limit: 5 }, { finder: finder(), people: null, research: false });
    await db.update(prospects).set({ website: null, score: "99" }).where(eq(prospects.website, "https://rossi.it"));
    const r = await researchBacklog(db, javad, { run: async (c) => (c.website ? research : Promise.reject(new Error("gemini 429: You exceeded your current quota"))) });
    expect(r.researched).toBe(1);
    expect(r.noSite).toBe(1);
    expect(r.stopped).toBeNull();
  });

  it("a failed research names its reason and is tried again next time", async () => {
    await findCustomers(db, javad, { industry: "installers", region: "Lombardia", limit: 5 }, { finder: finder(), people: null, research: false });
    const r = await researchBacklog(db, javad, { run: async () => Promise.reject(new Error("research answer was cut off (max_tokens)")) });
    expect(r.failed).toBe(2);
    expect(r.errors).toEqual(["research answer was cut off (max_tokens)"]);
    const again = await researchBacklog(db, javad, { run: async () => research });
    expect(again.researched).toBe(2);
    expect(await researchWaiting(db)).toBe(0);
  });

  it("leaves a company alone once Javad approved its messages", async () => {
    await findCustomers(db, javad, { industry: "installers", region: "Lombardia", limit: 5 }, { finder: finder(), people: null, research: false });
    const [p] = await db.select().from(prospects).limit(1);
    await approveSequence(db, javad, p.id);
    const r = await researchBacklog(db, javad, { run: async () => research });
    expect(r.researched).toBe(1);
    expect(r.waiting).toBe(0);
  });
});
