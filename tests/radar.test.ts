import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { RadarInput, RadarPick } from "@/agents/solutions-radar";
import { naceDivision } from "@/config/radar";
import { agentRuns, events, mediaPosts, radarItems } from "@/db/schema";
import { type ApprovalPress, mockAdminChat } from "@/providers/admin-chat";
import { type FeedItem, mockFeed, parseFeedList } from "@/providers/news-feed";
import { parseFeed } from "@/providers/news-feed/rss";
import { handlePress, sendWaitingAsks } from "@/server/admin-chat";
import { opsWatch } from "@/server/ops-watch";
import { dailyRadar, decideRadar, normalizeUrl, radarForHub, radarKpi, spread } from "@/server/radar";
import { javad, useTestDb } from "./helpers";

const db = useTestDb();
const now = new Date("2026-11-24T05:30:00Z"); // 06:30 Rome
const HOUR = 36e5;

const item = (n: number, source = "Product Hunt", hoursAgo = 2): FeedItem => ({ source, title: `Product ${n}: invoices in one click`, url: `https://example.org/p/${n}?utm_source=feed`, publishedAt: new Date(now.getTime() - hoursAgo * HOUR), summary: `Tool ${n} for small firms` });
const pick = (index: number, over: Partial<RadarPick> = {}): RadarPick => ({
  index,
  maker: `Maker ${index}`,
  problem: "Installers lose hours each week typing invoices by hand.",
  useCase: "An electrician photographs the job sheet and the invoice is ready.",
  industries: [{ nace: "F43.21", name: "Electrical installation" }],
  processes: ["9.0 Manage Financial Resources"],
  decision: "resell",
  why: "Sells to EU SMEs and has a reseller programme; check GDPR terms first.",
  fit: 4,
  effort: "low",
  takeaway: { en: "Small installers can cut invoice time by half this month.", it: "Gli installatori possono dimezzare il tempo delle fatture." },
  linkedin: "Invoices eat a day a month for most installers. ".repeat(8),
  summaryFa: "ابزاری برای صدور فاکتور با یک عکس؛ برای نصاب‌ها مفید است.",
  ...over,
});
const agent = (picks: (i: RadarInput) => RadarPick[]) => {
  const seen: RadarInput[] = [];
  return { seen, analyse: async (i: RadarInput) => (seen.push(i), picks(i)) };
};
function pressOf(id: string, decision: "approved" | "rejected") {
  const said: string[] = [];
  const press: ApprovalPress = { target: "ask", id, decision, by: "7", allowed: true, ack: async (t) => void said.push(t) };
  return { press, said };
}

describe("news feed adapter", () => {
  it("reads RSS and Atom, plain text only", () => {
    const rss = `<rss><channel><item><title><![CDATA[Acme &amp; Co launches <b>quotes</b>]]></title><link>https://acme.test/a</link><pubDate>Mon, 23 Nov 2026 10:00:00 GMT</pubDate><description>&lt;p&gt;Quotes in &#8220;one&#8221; minute&lt;/p&gt;</description></item></channel></rss>`;
    const atom = `<feed><entry><title>Beta</title><link rel="alternate" type="text/html" href="https://beta.test/x?a=1&amp;b=2"/><published>2026-11-23T09:00:00Z</published><content type="html">&lt;p&gt;Hello&lt;/p&gt;</content></entry><entry><title>no link</title></entry></feed>`;
    expect(parseFeed(rss, "R")).toEqual([{ source: "R", title: "Acme & Co launches quotes", url: "https://acme.test/a", publishedAt: new Date("2026-11-23T10:00:00Z"), summary: "Quotes in “one” minute" }]);
    expect(parseFeed(atom, "A")).toMatchObject([{ title: "Beta", url: "https://beta.test/x?a=1&b=2", summary: "Hello" }]);
    expect(parseFeedList("PH|https://ph.test/feed, https://x.test/rss, http://bad.test")).toEqual([{ name: "PH", url: "https://ph.test/feed" }, { name: "x.test", url: "https://x.test/rss" }]);
    expect(parseFeedList(undefined).length).toBeGreaterThan(3);
    expect(naceDivision("F43.21")).toBe("43");
    expect(naceDivision("62.01")).toBe("62");
    expect(normalizeUrl("https://a.test/p?utm_source=x&id=3#top")).toBe("https://a.test/p?id=3");
  });

  it("spreads the day over the feeds, newest first", () => {
    const many = [...Array.from({ length: 30 }, (_, i) => item(i, "Busy", i / 10)), item(99, "Quiet", 20)];
    const s = spread(many, 20, 15);
    expect(s.filter((x) => x.source === "Busy")).toHaveLength(15);
    expect(s.some((x) => x.source === "Quiet")).toBe(true);
  });
});

describe("solutions radar", () => {
  it("reads once a day, proposes the good ones, ignores the rest, digests on the phone, metered as an agent", async () => {
    const chat = mockAdminChat();
    const a = agent(() => [pick(0), pick(1, { decision: "ignore" }), pick(2, { fit: 2 })]);
    const feed = mockFeed([item(1), item(2), item(3), item(4, "TechCrunch"), { ...item(5), publishedAt: new Date(now.getTime() - 100 * HOUR) }]);
    const r = await dailyRadar(db, now, { feed, analyse: a.analyse, adminChat: chat });
    expect(r).toMatchObject({ day: "2026-11-24", read: 4, fresh: 4, proposed: 1, analyzer: "ai" });
    expect(a.seen[0].items).toHaveLength(4);
    expect(a.seen[0].industries.some((x) => x.nace.includes("F43.21"))).toBe(true); // our hubs steer the picks
    const rows = await db.select().from(radarItems);
    expect(rows.map((x) => x.status).sort()).toEqual(["ignored", "ignored", "ignored", "proposed"]);
    expect(rows.every((x) => !x.url.includes("utm_"))).toBe(true);
    expect(chat.sent[0].lines[0]).toContain("1 مورد به درد ما می‌خورد");
    expect((await db.select().from(agentRuns)).some((x) => x.agent === "solutions-radar" && x.ok)).toBe(true);

    expect(await dailyRadar(db, new Date(now.getTime() + HOUR), { feed, analyse: a.analyse })).toEqual({ skipped: "radar already ran for 2026-11-24" });
    expect(r).toMatchObject({ picked: 3 });
    // next day: what was read before is not read again
    const next = await dailyRadar(db, new Date(now.getTime() + 24 * HOUR), { feed: mockFeed([item(1), item(6)]), analyse: a.analyse });
    expect(next).toMatchObject({ fresh: 1 });
    expect(a.seen[1].seen).toContain("Maker 0"); // already proposed: the agent is told not to repeat it
  });

  it("without a model the items stay listed (unreviewed) and the digest says why", async () => {
    const chat = mockAdminChat();
    const r = await dailyRadar(db, now, { feed: mockFeed([item(1)]), analyse: async () => { throw new Error("quota"); }, adminChat: chat });
    expect(r).toMatchObject({ analyzer: "rules", error: "quota", proposed: 0 });
    expect((await db.select().from(radarItems))[0].status).toBe("unreviewed");
    expect(chat.sent[0].lines[0]).toContain("quota");
    // started again the same day (Cockpit "Run now"): the unanalysed items get their analysis
    const again = await dailyRadar(db, new Date(now.getTime() + HOUR), { feed: mockFeed([item(1)]), analyse: agent(() => [pick(0)]).analyse });
    expect(again).toMatchObject({ fresh: 1, proposed: 1, analyzer: "ai" });
  });

  it("✅ on the phone keeps it: LinkedIn post approved for its slot, event, hub news; ❌ dismisses with a note", async () => {
    await dailyRadar(db, now, { feed: mockFeed([item(1), item(2)]), analyse: agent(() => [pick(0), pick(1, { maker: "Other", industries: [{ nace: "C25.62", name: "Machining" }] })]).analyse });
    const chat = mockAdminChat();
    const { sent } = await sendWaitingAsks(db, chat, 20);
    expect(sent).toBe(2);
    const ask = chat.decisions.find((d) => d.title.includes("Maker 0"))!;
    expect(ask.lines.join("\n")).toContain("Invoices eat a day");
    const { press, said } = pressOf(ask.ref, "approved");
    await handlePress(db, press);
    expect(said[0]).toContain("نگه داشته شد");

    const [kept] = await db.select().from(radarItems).where(eq(radarItems.maker, "Maker 0"));
    expect(kept.status).toBe("shortlisted");
    const [post] = await db.select().from(mediaPosts).where(eq(mediaPosts.id, kept.mediaPostId!));
    expect(post).toMatchObject({ channel: "linkedin", theme: "solution", lang: "en", status: "approved", sourceUrl: kept.url });
    expect(post.scheduledFor! > now).toBe(true);
    expect((await db.select().from(events)).some((e) => e.type === "radar.shortlisted")).toBe(true);

    // hub news for the matching NACE division only, in the page's language
    expect(await radarForHub(db, ["F43.21", "F43.22"], "it", new Date(now.getTime() + HOUR))).toMatchObject([{ publisher: "Maker 0", takeaway: "Gli installatori possono dimezzare il tempo delle fatture." }]);
    expect(await radarForHub(db, ["C25.62"], "de", new Date(now.getTime() + HOUR))).toEqual([]);

    const other = chat.decisions.find((d) => d.title.includes("Other"))!;
    await handlePress(db, pressOf(other.ref, "rejected").press);
    const [gone] = await db.select().from(radarItems).where(eq(radarItems.maker, "Other"));
    expect(gone).toMatchObject({ status: "dismissed", note: "dismissed in Telegram" });
    await expect(decideRadar(db, javad, gone.id, "keep")).rejects.toThrow(/already/);
    expect(await radarKpi(db, new Date(now.getTime() + HOUR))).toMatchObject({ keptMonth: 1, waiting: 0, candidates: 1 });
  });

  it("the cockpit can keep without a post; ops-watch reminds after 3 days", async () => {
    await dailyRadar(db, now, { feed: mockFeed([item(1), item(2)]), analyse: agent(() => [pick(0), pick(1)]).analyse });
    const [first] = await db.select().from(radarItems).where(eq(radarItems.maker, "Maker 0"));
    const row = await decideRadar(db, javad, first.id, "keep", undefined, now);
    expect(row).toMatchObject({ status: "shortlisted", mediaPostId: null });
    const ops = await opsWatch(db, new Date(Date.now() + 80 * HOUR)); // rows carry the real creation time
    expect(ops.items.some((i) => i.kind === "radar" && i.text.startsWith("1 new solutions"))).toBe(true);
  });
});

describe("radar agent answer", () => {
  it("accepts numbers and choices written as strings by small models", async () => {
    const { pickSchema } = await import("@/agents/solutions-radar");
    const p = pickSchema.parse({ ...pick(0), index: "2", fit: "4", decision: "Resell", effort: "Low", processes: "9.0 Manage Financial Resources" });
    expect(p).toMatchObject({ index: 2, fit: 4, decision: "resell", effort: "low", processes: ["9.0 Manage Financial Resources"] });
  });
});
