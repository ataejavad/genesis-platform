import { and, desc, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { analyse as analyseWithModel, type RadarInput, type RadarPick, radarEnabled } from "@/agents/solutions-radar";
import { DECISION_LABEL, naceDivision, RADAR, type RadarDecision } from "@/config/radar";
import type { Db } from "@/db";
import { mediaPosts, organizations, radarItems } from "@/db/schema";
import { type FeedItem, type NewsFeed, newsFeedFromEnv } from "@/providers/news-feed";
import { type Actor, actorRef } from "./actor";
import type { AdminChat } from "./admin-chat";
import { runAgent } from "./agents";
import { planEnv } from "./crm";
import { conflict, notFound } from "./errors";
import { audit, emit } from "./events";
import { loadResearch } from "./hubs";
import { isoWeek, nextFree } from "./media";
import { romeDay } from "./orchestrator";
import { listPackages } from "./projects";

/*
 * Solutions radar (Javad 2026-11-24, "very useful for our content").
 *   daily 06:30   radar.daily : read the feeds (src/providers/news-feed), drop what we saw, the agent analyses the rest:
 *                               problem, industries (NACE), processes (APQC), resell / build / ignore, our take, a post
 *   phone / cockpit           : Javad keeps (✅ = shortlist + LinkedIn post scheduled) or dismisses each proposal
 *   kept solution             : LinkedIn post (media engine, one-tap), news with our take on matching hubs, marketplace
 *                               candidate in Cockpit › Radar, seed for the weekly media writer (newsletter)
 * KPI: € per solution kept. Nothing is public before Javad's ✅.
 */

type Item = typeof radarItems.$inferSelect;
const DAY = 864e5;

/** Same page, different tracking: drop utm_* / ref parameters and the fragment. */
export function normalizeUrl(u: string) {
  try {
    const x = new URL(u);
    x.hash = "";
    for (const k of [...x.searchParams.keys()]) if (/^(utm_|ref$|source$|fbclid|gclid)/i.test(k)) x.searchParams.delete(k);
    return x.toString().replace(/\?$/, "");
  } catch {
    return u;
  }
}

/** Newest first, at most `perSource` per feed, `max` in all, so one busy feed cannot fill the day. */
export function spread(items: FeedItem[], max = RADAR.maxItems, perSource = RADAR.perSource) {
  const sorted = [...items].sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));
  const per = new Map<string, number>();
  const out: FeedItem[] = [];
  for (const i of sorted) {
    const n = per.get(i.source) ?? 0;
    if (n >= perSource) continue;
    per.set(i.source, n + 1);
    out.push(i);
    if (out.length >= max) break;
  }
  return out;
}

async function industriesWeServe(db: Db) {
  const hubs = loadResearch().map((r) => ({ name: `${r.name.en} (${r.country})`, nace: r.nace }));
  const customers = await db.selectDistinct({ industry: organizations.industry }).from(organizations).where(and(eq(organizations.kind, "customer"), isNotNull(organizations.industry)));
  return [...hubs, ...customers.map((c) => ({ name: String(c.industry), nace: [] as string[] }))];
}

export type RadarDeps = { feed?: NewsFeed; analyse?: (i: RadarInput) => Promise<RadarPick[]>; force?: boolean; adminChat?: AdminChat | null };

/** Daily job: new items in, proposals out (asked on the phone by the tick), one digest line set to the founder chat. */
export async function dailyRadar(db: Db, now = new Date(), deps: RadarDeps = {}) {
  const day = romeDay(now);
  const done = await db.select({ id: radarItems.id }).from(radarItems).where(and(eq(radarItems.day, day), isNotNull(radarItems.analyzer))).limit(1);
  if (done.length && !deps.force) return { skipped: `radar already ran for ${day}` };

  const feed = deps.feed ?? newsFeedFromEnv();
  const { items: fetched, errors } = await feed.fetch(new Date(now.getTime() - RADAR.lookbackHours * 36e5));
  const byUrl = new Map(fetched.map((i) => [normalizeUrl(i.url), { ...i, url: normalizeUrl(i.url) }]));
  const urls = [...byUrl.keys()];
  const known = new Set<string>();
  for (let i = 0; i < urls.length; i += 500) {
    for (const r of await db.select({ url: radarItems.url }).from(radarItems).where(inArray(radarItems.url, urls.slice(i, i + 500)))) known.add(r.url);
  }
  const fresh = spread([...byUrl.values()].filter((i) => !known.has(i.url)));
  const rows = fresh.length
    ? await db
        .insert(radarItems)
        .values(fresh.map((i) => ({ day, source: i.source, url: i.url, title: i.title, publishedAt: i.publishedAt, summary: i.summary })))
        .onConflictDoNothing()
        .returning()
    : [];
  // items saved earlier today without analysis (a failed run) join this run
  const waiting = await db.select().from(radarItems).where(and(eq(radarItems.day, day), eq(radarItems.status, "new")));
  const list = [...new Map([...rows, ...waiting].map((r) => [r.id, r])).values()];

  const since = new Date(now.getTime() - 30 * DAY);
  const recent = await db.select({ title: radarItems.title, maker: radarItems.maker, status: radarItems.status, note: radarItems.note }).from(radarItems).where(and(gte(radarItems.createdAt, since), inArray(radarItems.status, ["proposed", "shortlisted", "dismissed"])));
  const input: RadarInput = {
    today: day,
    brand: planEnv().brand,
    items: list.map((r, index) => ({ index, source: r.source, title: r.title, summary: r.summary, date: r.publishedAt?.toISOString().slice(0, 10) ?? null })),
    industries: await industriesWeServe(db),
    packages: (await listPackages(db)).map((p) => p.title),
    seen: recent.map((r) => r.maker ?? r.title),
    dismissed: recent.filter((r) => r.status === "dismissed").map((r) => ({ title: r.maker ?? r.title, note: r.note })),
    maxPicks: RADAR.maxPicks,
  };

  let picks: RadarPick[] = [];
  let analyzer = "ai";
  let error: string | null = null;
  const analyse = deps.analyse ?? (radarEnabled() ? analyseWithModel : null);
  try {
    if (!list.length) picks = [];
    else if (!analyse) throw new Error("no AI model connected");
    else picks = await runAgent(db, "solutions-radar", "daily", () => analyse(input), { day, items: list.length });
  } catch (err) {
    // the day is never lost: items stay listed (unreviewed) and the digest says why
    error = err instanceof Error ? err.message.slice(0, 200) : "failed";
    analyzer = "rules";
  }

  const proposed: Item[] = [];
  await db.transaction(async (tx) => {
    for (const [index, r] of list.entries()) {
      const p = analyzer === "ai" ? picks.find((x) => x.index === index) : undefined;
      if (!p) {
        await tx.update(radarItems).set({ analyzer, status: analyzer === "ai" ? "ignored" : "unreviewed" }).where(eq(radarItems.id, r.id));
        continue;
      }
      const propose = p.decision !== "ignore" && p.fit >= RADAR.minFit;
      const [row] = await tx
        .update(radarItems)
        .set({ analyzer, maker: p.maker, problem: p.problem, useCase: p.useCase, industries: p.industries, processes: p.processes, decision: p.decision, why: p.why, fit: p.fit, effort: p.effort, takeaway: Object.fromEntries(Object.entries({ ...p.takeaway, fa: p.summaryFa }).filter(([, v]) => v)) as Record<string, string>, linkedin: p.linkedin, summaryFa: p.summaryFa, status: propose ? "proposed" : "ignored" })
        .where(eq(radarItems.id, r.id))
        .returning();
      if (propose) proposed.push(row);
    }
    await audit(tx, { type: "system", id: "solutions-radar" }, "radar.ran", { type: "radar_day", id: day }, null, { read: fetched.length, fresh: list.length, proposed: proposed.length, analyzer, error, feedErrors: errors });
  });

  if (deps.adminChat && (list.length || error)) await deps.adminChat.alert(digestLines(day, list.length, proposed, error, errors), "/cockpit/radar").catch(() => null);
  return { day, read: fetched.length, fresh: list.length, proposed: proposed.length, analyzer, top: proposed.map((p) => `${p.maker ?? p.title} [${p.decision}, fit ${p.fit}]`), ...(error ? { error } : {}), ...(errors.length ? { feedErrors: errors } : {}) };
}

/** The one daily message: verdict first, then one line per proposal (each comes as its own ✅/❌ ask right after). */
export function digestLines(day: string, read: number, proposed: Item[], error: string | null, feedErrors: string[] = []) {
  const head = proposed.length
    ? `📡 رادار راه‌حل‌ها (${day}): ${read} خبر و محصول تازه بررسی شد، ${proposed.length} مورد به درد ما می‌خورد.`
    : error
      ? `📡 رادار راه‌حل‌ها (${day}): ${read} مورد خوانده شد ولی تحلیل نشد (${error}). فهرست در کابین است.`
      : `📡 رادار راه‌حل‌ها (${day}): ${read} مورد بررسی شد؛ امروز چیز ارزشمندی نبود.`;
  const lines = proposed.map((p, i) => {
    const d = DECISION_LABEL[(p.decision ?? "ignore") as RadarDecision];
    return `${i + 1}. ${d.icon} ${p.maker ?? p.title} · ${d.fa} · تناسب ${p.fit}/5\n${p.summaryFa ?? p.problem ?? ""}`;
  });
  return [head, ...lines, proposed.length ? "برای هر مورد یک پیام جدا با ✅ (نگه دار + پست لینکدین) / ❌ می‌آید." : "", feedErrors.length ? `⚠️ منبع‌هایی که جواب ندادند: ${feedErrors.join("، ")}` : ""].filter(Boolean);
}

/* ───────────── Javad's decision (phone and cockpit call the same function) ───────────── */

export type RadarAction = "keep_post" | "keep" | "dismiss";

/** Keep (shortlist; with the LinkedIn post approved for its next free slot) or dismiss a proposal. */
export async function decideRadar(db: Db, actor: Actor, id: string, action: RadarAction, note?: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const [r] = await tx.select().from(radarItems).where(eq(radarItems.id, id)).for("update");
    if (!r) throw notFound("radar item");
    if (!["proposed", "unreviewed", "ignored"].includes(r.status)) throw conflict(`already ${r.status}`);
    let mediaPostId: string | null = null;
    if (action === "keep_post" && r.linkedin) {
      const week = isoWeek(now);
      const [{ pos }] = await tx.select({ pos: sql<number>`coalesce(max(${mediaPosts.position}), 99)::int` }).from(mediaPosts).where(and(eq(mediaPosts.week, week), eq(mediaPosts.channel, "linkedin"), eq(mediaPosts.lang, "en"), gte(mediaPosts.position, 100)));
      // Javad saw this exact text with the proposal: the post is approved and waits for its slot (20 h from other posts)
      const [draft] = await tx
        .insert(mediaPosts)
        .values({ channel: "linkedin", week, position: Number(pos) + 1, theme: "solution", lang: "en", title: `${r.maker ?? r.title}`.slice(0, 140), body: r.linkedin, bodyFa: r.summaryFa, sourceUrl: r.url, sourceTitle: r.source, cta: "newsletter", status: "draft", writer: "ai" })
        .returning();
      const [post] = await tx.update(mediaPosts).set({ status: "approved", scheduledFor: await nextFree(tx, draft, now), decidedBy: actorRef(actor), decidedAt: now }).where(eq(mediaPosts.id, draft.id)).returning();
      mediaPostId = post.id;
    }
    const keep = action !== "dismiss";
    const [row] = await tx
      .update(radarItems)
      .set({ status: keep ? "shortlisted" : "dismissed", mediaPostId, decidedBy: actorRef(actor), decidedAt: now, note: note?.slice(0, 500) ?? null })
      .where(eq(radarItems.id, id))
      .returning();
    if (keep) await emit(tx, actor, "radar.shortlisted", { type: "radar_item", id }, { maker: r.maker, decision: r.decision, fit: r.fit, industries: r.industries.map((i) => i.nace), post: Boolean(mediaPostId) });
    await audit(tx, actor, keep ? "radar.shortlisted" : "radar.dismissed", { type: "radar_item", id }, { status: r.status }, { status: row.status, mediaPostId, note: row.note });
    return row;
  });
}

/* ───────────── what a kept solution feeds ───────────── */

/** Kept solutions for a hub's industries, as hub news with our take in the page's language (English otherwise). */
export async function radarForHub(db: Db, nace: string[], lang: string, now = new Date()) {
  const want = new Set(nace.map(naceDivision).filter(Boolean));
  if (!want.size) return [];
  const rows = await db.select().from(radarItems).where(and(eq(radarItems.status, "shortlisted"), gte(radarItems.decidedAt, new Date(now.getTime() - RADAR.hubDays * DAY)))).orderBy(desc(radarItems.decidedAt)).limit(100);
  return rows
    .filter((r) => r.industries.some((i) => want.has(naceDivision(i.nace))))
    .slice(0, RADAR.hubMax)
    .map((r) => ({ date: (r.publishedAt ?? r.decidedAt ?? r.createdAt).toISOString().slice(0, 10), publisher: r.maker ?? r.source, url: r.url, title: r.title, takeaway: r.takeaway[lang] ?? r.takeaway.en ?? r.problem ?? "" }));
}

/* ───────────── Cockpit › Radar, Systems, ops-watch ───────────── */

export async function radarList(db: Db, status?: string[], limit = 100) {
  return db.select().from(radarItems).where(status ? inArray(radarItems.status, status) : undefined).orderBy(desc(radarItems.day), desc(radarItems.fit), desc(radarItems.createdAt)).limit(limit);
}

export async function radarKpi(db: Db, now = new Date()) {
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const n = sql<number>`count(*)::int`;
  const [read] = await db.select({ n }).from(radarItems).where(gte(radarItems.createdAt, month));
  const [kept] = await db.select({ n }).from(radarItems).where(and(eq(radarItems.status, "shortlisted"), gte(radarItems.decidedAt, month)));
  const [waiting] = await db.select({ n }).from(radarItems).where(eq(radarItems.status, "proposed"));
  const [candidates] = await db.select({ n }).from(radarItems).where(and(eq(radarItems.status, "shortlisted"), inArray(radarItems.decision, ["resell", "build"])));
  const [last] = await db.select({ day: radarItems.day }).from(radarItems).where(isNotNull(radarItems.analyzer)).orderBy(desc(radarItems.day)).limit(1);
  return { readMonth: Number(read?.n ?? 0), keptMonth: Number(kept?.n ?? 0), waiting: Number(waiting?.n ?? 0), candidates: Number(candidates?.n ?? 0), lastDay: last?.day ?? null };
}

/** Proposals nobody decided for RADAR.decideHours (they go stale as news). */
export async function staleProposals(db: Db, now = new Date()) {
  return db.select({ id: radarItems.id }).from(radarItems).where(and(eq(radarItems.status, "proposed"), lt(radarItems.createdAt, new Date(now.getTime() - RADAR.decideHours * 36e5))));
}
