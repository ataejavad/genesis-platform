import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import type { WriterInput, WriterOut } from "@/agents/media-writer";
import { MEDIA } from "@/config/media";
import { agentRuns, events, leads, mediaPosts, notifications, radarItems } from "@/db/schema";
import { type ApprovalPress, mockAdminChat } from "@/providers/admin-chat";
import { mockPublisher } from "@/providers/social";
import { handlePress, sendWaitingAsks } from "@/server/admin-chat";
import { confirmMediaPosted, decideMedia, editMedia, isoWeek, mediaKpi, publicMedia, publishDue, sameTopic, todayPost, weeklyDrafts } from "@/server/media";
import { javad, useTestDb } from "./helpers";

const db = useTestDb();
const monday = new Date("2026-11-23T06:00:00Z"); // 07:00 Rome
const HOUR = 36e5;

const text = (n: number) => `Post number ${n}. `.repeat(10);
const week = (over: Partial<WriterOut> = {}): WriterOut => ({
  linkedin: MEDIA.linkedin.map((p, index) => ({ index, title: `LinkedIn ${index} ${p.theme}`, text: text(index), textFa: "ترجمه فارسی این پست", sourceUrl: p.theme === "news" ? `https://example.org/news/${index}` : null, sourceTitle: p.theme === "news" ? "Example News" : null })),
  youtube: [{ index: 0, title: "Video", text: text(9), textFa: "اسکریپت ویدیو به فارسی" }],
  newsletter: MEDIA.newsletter.langs.map((lang) => ({ lang, subject: `Brief ${lang}`, text: `Issue in ${lang}. `.repeat(20), summaryFa: "خلاصه این شماره به فارسی" })),
  ...over,
});
const writer = (out = week()) => {
  const seen: WriterInput[] = [];
  return { seen, write: async (i: WriterInput) => (seen.push(i), out) };
};
function pressOf(id: string, decision: "approved" | "rejected") {
  const said: string[] = [];
  const press: ApprovalPress = { target: "ask", id, decision, by: "7", allowed: true, ack: async (t) => void said.push(t) };
  return { press, said };
}
const all = () => db.select().from(mediaPosts);

describe("media engine", () => {
  it("drafts the week once: posts, a video script and the newsletter issues, metered as an agent", async () => {
    const w = writer();
    const r = await weeklyDrafts(db, monday, { write: w.write });
    expect(r).toMatchObject({ week: "2026-W48", drafts: MEDIA.linkedin.length + MEDIA.youtube.length + MEDIA.newsletter.langs.length, writer: "ai" });
    expect(await weeklyDrafts(db, monday, { write: w.write })).toEqual({ skipped: "week 2026-W48 already written" });
    expect(w.seen).toHaveLength(1);
    expect(w.seen[0].pains.length).toBeGreaterThan(0); // hub research feeds the writer
    const rows = await all();
    expect(rows.every((p) => p.status === "draft" && p.scheduledFor! > monday)).toBe(true);
    expect(rows.find((p) => p.theme === "news")?.sourceUrl).toBe("https://example.org/news/0");
    expect((await db.select().from(agentRuns)).some((a) => a.agent === "media-writer" && a.ok)).toBe(true);
    expect(isoWeek(new Date("2026-12-31T12:00:00Z"))).toBe("2026-W53");
  });

  it("never leaves the week empty: without a model it builds posts from the hub research", async () => {
    const r = await weeklyDrafts(db, monday, { write: async () => { throw new Error("quota"); } });
    expect(r).toMatchObject({ writer: "rules", error: "quota" });
    const rows = await all();
    expect(rows.filter((p) => p.channel === "linkedin")).toHaveLength(MEDIA.linkedin.length);
    expect(rows.every((p) => p.writer === "rules" && p.body.length > 20)).toBe(true);
  });

  it("asks on the phone; approve schedules it, reject keeps the note for the writer", async () => {
    await weeklyDrafts(db, monday, { write: writer().write });
    const chat = mockAdminChat();
    const { sent } = await sendWaitingAsks(db, chat, 20);
    expect(sent).toBe((await all()).length);
    const first = chat.decisions.find((d) => d.title.includes("LinkedIn 0"))!;
    expect(first.lines.join("\n")).toContain("ترجمه فارسی");
    expect(first.lines.join("\n")).toContain("https://example.org/news");
    const a = pressOf(first.ref, "approved");
    expect(await handlePress(db, a.press)).toBe("approved");
    const second = chat.decisions.find((d) => d.title.includes("LinkedIn 1"))!;
    expect(await handlePress(db, pressOf(second.ref, "rejected").press)).toBe("rejected");
    const rows = await all();
    expect(rows.find((p) => p.title.startsWith("LinkedIn 0"))).toMatchObject({ status: "approved", decidedBy: "telegram:7" });
    expect(rows.find((p) => p.title.startsWith("LinkedIn 1"))).toMatchObject({ status: "rejected", note: "rejected in Telegram" });
    // next week the writer sees what was rejected
    const w = writer();
    await weeklyDrafts(db, new Date(monday.getTime() + 7 * 24 * HOUR), { write: w.write });
    expect(w.seen[0].rejected.map((x) => x.title)).toContain("LinkedIn 1 pain");
  });

  it("hands a due LinkedIn post over as one tap, then counts it once Javad confirms", async () => {
    await weeklyDrafts(db, monday, { write: writer().write });
    const post = (await all()).find((p) => p.channel === "linkedin" && p.position === 0)!;
    await decideMedia(db, javad, post.id, true, undefined, monday);
    const publisher = mockPublisher();
    expect((await publishDue(db, publisher, monday)).handed).toBe(0); // not its time yet
    const at = new Date(post.scheduledFor!.getTime() + 60e3);
    expect((await publishDue(db, publisher, at)).handed).toBe(1);
    expect(publisher.published[0].link).toContain(`checkup?from=media-${post.id.slice(0, 8)}`);
    const chat = mockAdminChat();
    await sendWaitingAsks(db, chat, 20);
    const ask = chat.decisions.find((d) => d.title.includes("وقت پست لینکدین"))!;
    expect(ask.link).toBe(`/api/media/${post.id}/share`);
    expect(await handlePress(db, pressOf(ask.ref, "approved").press)).toBe("approved");
    expect((await db.select().from(mediaPosts).where(eq(mediaPosts.id, post.id)))[0].status).toBe("posted");
    expect((await db.select().from(events)).filter((e) => e.type === "media.published")).toHaveLength(1);
    // the site's media page shows only posted LinkedIn pieces, from their time on (drafts and the rest of the week stay off)
    expect((await publicMedia(db, new Date("2100-01-01"))).map((p) => p.id)).toEqual([post.id]);
    expect(await publicMedia(db, monday)).toHaveLength(0);
    await expect(confirmMediaPosted(db, javad, post.id, true)).rejects.toThrow(/nothing waiting/);
  });

  it("keeps LinkedIn posts apart when approvals come after their slot", async () => {
    await weeklyDrafts(db, monday, { write: writer().write });
    const late = new Date("2026-11-27T10:00:00Z"); // Friday, every slot but Friday's passed
    const posts = (await all()).filter((p) => p.channel === "linkedin");
    const times: number[] = [];
    for (const p of posts) times.push((await decideMedia(db, javad, p.id, true, undefined, late)).scheduledFor!.getTime());
    times.sort();
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(MEDIA.minGapHours * HOUR);
    expect(times[0]).toBeGreaterThan(late.getTime());
  });

  it("a working day without a post gets one fresh draft; by hand it always writes one", async () => {
    const thu = new Date("2026-11-26T06:15:00Z"); // Thursday 07:15 Rome
    const one = writer(week({ linkedin: [{ index: 0, title: "Today's take", text: text(1), textFa: "ترجمه فارسی پست امروز", sourceUrl: "https://example.org/n", sourceTitle: "Example" }], youtube: [], newsletter: [] }));
    const r = await todayPost(db, thu, { write: one.write });
    expect(r).toMatchObject({ day: "2026-11-26", drafts: 1, writer: "ai" });
    expect(one.seen[0].plan).toHaveLength(1);
    expect(one.seen[0].newsletterLangs).toEqual([]);
    const [p] = await all();
    expect(p).toMatchObject({ status: "draft", channel: "linkedin", lang: "en", title: "Today's take" });
    expect(p.position).toBeGreaterThanOrEqual(200);
    expect(p.scheduledFor!.toISOString()).toBe("2026-11-26T11:30:00.000Z"); // 12:30 Rome
    // the day has a post now (and a draft waits): the schedule does nothing more, a hand-started run still writes one
    expect(await todayPost(db, thu, { write: one.write })).toMatchObject({ skipped: expect.stringMatching(/already planned/) });
    expect(await todayPost(db, new Date("2026-11-28T06:15:00Z"), { write: one.write })).toEqual({ skipped: "weekend" });
    const evening = new Date("2026-11-26T19:45:00Z");
    const two = writer(week({ linkedin: [{ index: 0, title: "Another take", text: text(2), textFa: "ترجمه فارسی پست دوم", sourceUrl: "https://example.org/m", sourceTitle: "Example" }], youtube: [], newsletter: [] }));
    expect(await todayPost(db, evening, { manual: true, write: two.write })).toMatchObject({ drafts: 1 });
    const extra = (await all()).find((x) => x.id !== p.id)!;
    // approved in the evening: next morning, kept a few hours from the other post, not a whole day
    await decideMedia(db, javad, p.id, true, undefined, thu);
    const at = (await decideMedia(db, javad, extra.id, true, undefined, evening)).scheduledFor!;
    expect(at.getTime()).toBeGreaterThan(evening.getTime());
    expect(at.getTime() - evening.getTime()).toBeLessThan(24 * HOUR);
  });

  it("one topic, one post: approving a post skips the same topic waiting for its slot, and the daily post avoids taken topics", async () => {
    expect(sameTopic({ title: "elbic", sourceUrl: "https://www.eu-startups.com/2026/11/elbic?utm=x" }, { title: "elbic voice AI funding news", sourceUrl: null })).toBe(true);
    expect(sameTopic({ title: "x", sourceUrl: "https://eu-startups.com/2026/11/elbic/" }, { title: "y", sourceUrl: "http://www.eu-startups.com/2026/11/elbic?utm=x" })).toBe(true);
    expect(sameTopic({ title: "Bound", sourceUrl: null }, { title: "Boundless growth for installers", sourceUrl: null })).toBe(false);
    const thu = new Date("2026-11-26T19:45:00Z");
    const [radarPost] = await db.insert(mediaPosts).values({ week: "2026-W48", channel: "linkedin", position: 100, theme: "solution", lang: "en", title: "elbic", body: text(3), sourceUrl: "https://example.org/elbic", cta: "newsletter", status: "approved", scheduledFor: new Date("2026-11-29T07:30:00Z") }).returning();
    // the writer is offered no news about a topic that already has a post
    const w = writer(week({ linkedin: [{ index: 0, title: "elbic voice AI funding news", text: text(4), textFa: "ترجمه فارسی پست امروز", sourceUrl: "https://example.org/elbic", sourceTitle: "EU-Startups" }], youtube: [], newsletter: [] }));
    await db.insert(radarItems).values({ day: "2026-11-26", source: "EU-Startups", url: "https://example.org/elbic", title: "elbic raises", maker: "elbic", status: "shortlisted", fit: 5, takeaway: { en: "voice agents for small firms" }, decidedAt: thu, createdAt: thu });
    await todayPost(db, thu, { manual: true, write: w.write });
    expect(w.seen[0].news.some((n) => n.url === "https://example.org/elbic")).toBe(false);
    // approving the new post moves the queued one aside by itself
    const fresh = (await all()).find((p) => p.status === "draft")!;
    await decideMedia(db, javad, fresh.id, true, undefined, thu);
    const [after] = await db.select().from(mediaPosts).where(eq(mediaPosts.id, radarPost.id));
    expect(after.status).toBe("skipped");
    expect(after.note).toMatch(/same topic/);
  });

  it("without a model the daily post is the best fresh radar proposal", async () => {
    const thu = new Date("2026-11-26T06:15:00Z");
    await db.insert(radarItems).values({ day: "2026-11-26", source: "Product Hunt", url: "https://example.org/tool", title: "Tool", maker: "ToolCo", status: "proposed", fit: 4, linkedin: text(7), summaryFa: "خلاصه", createdAt: thu });
    const r = await todayPost(db, thu, { write: async () => { throw new Error("quota"); } });
    expect(r).toMatchObject({ drafts: 1, writer: "radar", error: "quota" });
    expect((await all())[0]).toMatchObject({ title: "ToolCo", theme: "solution", body: text(7) });
  });

  it("an edit sends an approved piece back for approval", async () => {
    await weeklyDrafts(db, monday, { write: writer().write });
    const p = (await all())[0];
    await decideMedia(db, javad, p.id, true, undefined, monday);
    const e = await editMedia(db, javad, p.id, { body: "A better text written by Javad himself." });
    expect(e.status).toBe("draft");
  });

  it("sends the newsletter only to confirmed subscribers, in their language or English, with one-click unsubscribe", async () => {
    const base = { industry: "general", hook: "newsletter", tags: ["newsletter"], consentText: "I agree to the weekly brief", consentAt: monday };
    await db.insert(leads).values([
      { ...base, email: "it@x.it", country: "IT", locale: "it-it", confirmedAt: monday },
      { ...base, email: "de@x.de", country: "DE", locale: "de-de", confirmedAt: monday },
      { ...base, email: "new@x.it", country: "IT", locale: "it-it" },
      { ...base, email: "gone@x.it", country: "IT", locale: "it-it", confirmedAt: monday, unsubscribedAt: monday },
      { ...base, email: "hub@x.it", country: "IT", locale: "it-it", hook: "scadenzario", tags: [], confirmedAt: monday },
    ]);
    await weeklyDrafts(db, monday, { write: writer().write });
    for (const p of (await all()).filter((x) => x.channel === "newsletter")) await decideMedia(db, javad, p.id, true, undefined, monday);
    const r = await publishDue(db, mockPublisher(), new Date(monday.getTime() + 4 * 24 * HOUR));
    expect(r).toMatchObject({ sent: MEDIA.newsletter.langs.length, recipients: 2 });
    const mails = await db.select().from(notifications);
    expect(mails.map((m) => m.email).sort()).toEqual(["de@x.de", "it@x.it"]);
    expect(mails.find((m) => m.email === "it@x.it")).toMatchObject({ subject: MEDIA.newsletter.langs.includes("it") ? "Brief it" : "Brief en", kind: "marketing" });
    expect(mails.find((m) => m.email === "de@x.de")?.subject).toBe("Brief en"); // no German issue: English
    expect(mails.every((m) => m.unsubscribeUrl?.includes("/api/v1/leads/unsubscribe"))).toBe(true);
    const k = await mediaKpi(db, new Date(monday.getTime() + 4 * 24 * HOUR));
    expect(k).toMatchObject({ subscribers: 2, publishedMonth: MEDIA.newsletter.langs.length });
  });
});
