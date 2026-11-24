import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, like, lte, ne, or, sql } from "drizzle-orm";
import { type WriterInput, type WriterOut, writeWeek, writerEnabled } from "@/agents/media-writer";
import { type Cta, MEDIA, type MediaChannel, type MediaTheme, mediaFocus, type Slot } from "@/config/media";
import type { Db, DbOrTx } from "@/db";
import { agentRuns, checkups, leads, mediaPosts, partners, prospects, touches } from "@/db/schema";
import type { SocialPublisher } from "@/providers/social";
import { type Actor, actorRef } from "./actor";
import { runAgent, spentEur } from "./agents";
import { planEnv } from "./crm";
import { AppError, conflict, notFound } from "./errors";
import { audit, emit } from "./events";
import { type HubResearch, loadResearch } from "./hubs";
import { leadUnsubscribeUrl, queue } from "./notify";
import { romeDay, romeInstant } from "./orchestrator";

/*
 * Media engine (doc 11; Javad "turn it on" 2026-11-21).
 *   Monday 07:00  media.drafts : the media agent writes the week (LinkedIn posts, a video script, the newsletter issues)
 *   phone / cockpit            : Javad approves or rejects each piece (approve/reject buttons, src/server/phone-asks.ts)
 *   every 10 min  media.publish: due pieces go out. LinkedIn: through SOCIAL_PROVIDER; the free default hands Javad a
 *                                one-tap link with the post written, he presses Post and confirms. Newsletter: by email to
 *                                confirmed subscribers only, each with a one-click unsubscribe.
 * Every piece links to the newsletter or the free check-up with ?from=media-<id>, so Cockpit › Media can count what
 * the media brings (goal: 500 subscribers and 5 check-ups a month by May 2027).
 */

type Post = typeof mediaPosts.$inferSelect;
const DAY = 864e5;
const HOUR = 36e5;
const LOCALE: Record<string, string> = { it: "it-it", en: "en-gb", de: "de-de", fa: "fa-ir" };

/* ───────────── calendar (Rome time) ───────────── */

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const isoDow = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
/** Monday (Rome date) of the week `now` is in */
export const weekMonday = (now: Date) => {
  const d = romeDay(now);
  return addDays(d, 1 - isoDow(d));
};
/** ISO week label, e.g. 2026-W48 */
export function isoWeek(now: Date) {
  const thu = new Date(Date.parse(`${weekMonday(now)}T12:00:00Z`) + 3 * DAY);
  const jan1 = Date.UTC(thu.getUTCFullYear(), 0, 1);
  return `${thu.getUTCFullYear()}-W${String(Math.floor((thu.getTime() - jan1) / DAY / 7) + 1).padStart(2, "0")}`;
}
const slotOf = (monday: string, s: Slot) => romeInstant(addDays(monday, s.weekday - 1), s.at);
const romeHour = (d: Date) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Rome", hour: "2-digit", hourCycle: "h23" }).format(d));

/** Where the piece sends people, tagged so the check-up and the sign-up know it came from this piece. */
export function ctaLink(p: Pick<Post, "id" | "cta" | "lang" | "industry">, appUrl = planEnv().appUrl) {
  const locale = LOCALE[p.lang] ?? "en-gb";
  const from = `media-${p.id.slice(0, 8)}`;
  return p.cta === "checkup" ? `${appUrl}/${locale}/checkup?from=${from}${p.industry ? `&industry=${p.industry}` : ""}` : `${appUrl}/${locale}?from=${from}#newsletter`;
}

/* ───────────── weekly drafts ───────────── */

const pickText = (t: Record<string, string> | undefined, lang: string) => (t ? (t[lang] ?? t.en ?? "") : "");

async function weekFacts(db: Db, now: Date) {
  const from = new Date(now.getTime() - 7 * DAY);
  const n = async (q: Promise<{ n: number }[]>) => Number((await q)[0]?.n ?? 0);
  return {
    companiesFound: await n(db.select({ n: sql<number>`count(*)::int` }).from(prospects).where(gte(prospects.createdAt, from))),
    messagesSent: await n(db.select({ n: sql<number>`count(*)::int` }).from(touches).where(gte(touches.sentAt, from))),
    checkups: await n(db.select({ n: sql<number>`count(*)::int` }).from(checkups).where(gte(checkups.createdAt, from))),
    newSignups: await n(db.select({ n: sql<number>`count(*)::int` }).from(leads).where(gte(leads.createdAt, from))),
    agentRuns: await n(db.select({ n: sql<number>`count(*)::int` }).from(agentRuns).where(gte(agentRuns.createdAt, from))),
    activePartners: await n(db.select({ n: sql<number>`count(*)::int` }).from(partners).where(eq(partners.status, "active"))),
    aiCostEur: Number((await db.select({ eur: sql<string>`coalesce(sum(${agentRuns.costEur}), 0)` }).from(agentRuns).where(gte(agentRuns.createdAt, from)))[0]?.eur ?? 0).toFixed(2),
  };
}

type Row = typeof mediaPosts.$inferInsert;

/** Rule-based week from the hub research (no model, or the model failed): news + our one-line take, a pain, a number. */
export function fallbackWeek(r: HubResearch | undefined, facts: Record<string, number | string>, used: Set<string>): WriterOut {
  const news = [...(r?.news ?? [])].sort((a, b) => b.date.localeCompare(a.date)).filter((n) => !used.has(pickText(n.title, "en")));
  const pains = (r?.pains ?? []).filter((p) => !used.has(pickText(p.text, "en").slice(0, 120)));
  const name = (lang: string) => pickText(r?.name, lang) || "small firms";
  let ni = 0;
  let pi = 0;
  const linkedin = MEDIA.linkedin.map((p, index) => {
    if (p.theme === "news" && news[ni]) {
      const n = news[ni++];
      return { index, title: pickText(n.title, "en").slice(0, 140), text: `${pickText(n.title, p.lang)}\n\n${pickText(n.takeaway, p.lang)}\n\n(${n.publisher}, ${n.date})`, textFa: pickText(n.takeaway, "fa") || pickText(n.takeaway, "en"), sourceUrl: n.url, sourceTitle: n.publisher };
    }
    if (p.theme !== "build" && pains[pi]) {
      const x = pains[pi++];
      return { index, title: pickText(x.text, "en").slice(0, 120), text: `${name(p.lang)}:\n\n${pickText(x.text, p.lang)}`, textFa: pickText(x.text, "fa") || pickText(x.text, "en"), sourceUrl: x.sources[0]?.url ?? null, sourceTitle: x.sources[0]?.name ?? null };
    }
    const line = `This week our small team and its AI agents found ${facts.companiesFound} companies, ran ${facts.agentRuns} agent tasks for €${facts.aiCostEur} and welcomed ${facts.newSignups} new sign-ups. Building a company in public, one week at a time.`;
    return { index, title: `Week in numbers ${facts.companiesFound}/${facts.agentRuns}`, text: line, textFa: `این هفته: ${facts.companiesFound} شرکت پیدا شد، ${facts.agentRuns} کار ایجنت با ${facts.aiCostEur} یورو، ${facts.newSignups} عضو تازه.` };
  });
  const youtube = MEDIA.youtube.flatMap((p, index) => {
    const x = pains[pi] ?? pains[0];
    return x ? [{ index, title: `Video: ${pickText(x.text, "en").slice(0, 100)}`, text: `[SHOT] ${name(p.lang)}\n${pickText(x.text, p.lang)}\n[SHOT] check-up`, textFa: pickText(x.text, "fa") || pickText(x.text, "en") }] : [];
  });
  const newsletter = MEDIA.newsletter.langs.map((lang) => ({
    lang,
    subject: `${name(lang)}: brief ${new Date().toISOString().slice(0, 10)}`,
    text: [...news.slice(0, 2).map((n) => `${pickText(n.title, lang)}\n${pickText(n.takeaway, lang)}\n${n.url}`), ...pains.slice(0, 1).map((p) => pickText(p.text, lang))].join("\n\n") || name(lang),
    summaryFa: "نسخه خودکار از تحقیق هاب (بدون مدل هوش مصنوعی).",
  }));
  return { linkedin, youtube, newsletter: newsletter.filter((n) => n.text.length >= 1) };
}

/** Monday job: the media agent writes the week's pieces as drafts for Javad. Once per week unless `force`. */
export async function weeklyDrafts(db: Db, now = new Date(), opts: { force?: boolean; write?: (i: WriterInput) => Promise<WriterOut> } = {}) {
  const week = isoWeek(now);
  const monday = weekMonday(now);
  const have = await db.select({ id: mediaPosts.id }).from(mediaPosts).where(eq(mediaPosts.week, week)).limit(1);
  if (have.length && !opts.force) return { skipped: `week ${week} already written` };
  const focus = mediaFocus();
  const research = loadResearch();
  const r = research.find((x) => x.industry === focus.industry && x.country === focus.country) ?? research[0];
  const past = await db.select({ title: mediaPosts.title, status: mediaPosts.status, note: mediaPosts.note }).from(mediaPosts).where(gte(mediaPosts.createdAt, new Date(now.getTime() - 84 * DAY)));
  const facts = await weekFacts(db, now);
  const input: WriterInput = {
    today: romeDay(now),
    brand: planEnv().brand,
    founder: planEnv().sender,
    focus: { industry: focus.industry, country: focus.country, name: pickText(r?.name, "en") || focus.industry },
    plan: [...MEDIA.linkedin.map((p, index) => ({ channel: "linkedin" as const, index, ...p })), ...MEDIA.youtube.map((p, index) => ({ channel: "youtube" as const, index, ...p }))].map(({ slot: _s, ...p }) => p),
    newsletterLangs: MEDIA.newsletter.langs,
    pains: (r?.pains ?? []).map((p) => ({ text: pickText(p.text, "en"), source: p.sources[0]?.url })),
    news: (r?.news ?? []).map((n) => ({ date: n.date, publisher: n.publisher, url: n.url, title: pickText(n.title, "en"), takeaway: pickText(n.takeaway, "en") })),
    week: facts,
    used: past.filter((p) => p.status !== "rejected").map((p) => p.title),
    rejected: past.filter((p) => p.status === "rejected").map((p) => ({ title: p.title, note: p.note })),
  };

  let out: WriterOut;
  let writer = "ai";
  let error: string | null = null;
  const write = opts.write ?? (writerEnabled() ? writeWeek : null);
  try {
    if (!write) throw new Error("no AI model with web search connected");
    out = await runAgent(db, "media-writer", "week", () => write(input), { week });
  } catch (err) {
    // the week is never empty: news + our one-line take from the hub research (memory: value filter fallback)
    error = err instanceof Error ? err.message.slice(0, 200) : "failed";
    writer = "rules";
    out = fallbackWeek(r, facts, new Set(input.used));
  }

  const base = { week, industry: focus.industry, country: focus.country, writer };
  const rows: Row[] = [];
  for (const [channel, plan, items] of [
    ["linkedin", MEDIA.linkedin, out.linkedin],
    ["youtube", MEDIA.youtube, out.youtube],
  ] as const) {
    for (const it of items) {
      const p = plan[it.index];
      if (!p) continue;
      rows.push({ ...base, channel, position: it.index, theme: p.theme, lang: p.lang, cta: p.cta, title: it.title, body: it.text, bodyFa: it.textFa, sourceUrl: it.sourceUrl ?? null, sourceTitle: it.sourceTitle ?? null, scheduledFor: slotOf(monday, p.slot) });
    }
  }
  for (const [i, n] of out.newsletter.entries()) {
    if (!MEDIA.newsletter.langs.includes(n.lang)) continue;
    rows.push({ ...base, channel: "newsletter", position: i, theme: "digest", lang: n.lang, cta: "checkup", title: n.subject, body: n.text, bodyFa: n.summaryFa, scheduledFor: slotOf(monday, MEDIA.newsletter.slot) });
  }
  const saved = rows.length ? await db.insert(mediaPosts).values(rows).onConflictDoNothing().returning({ id: mediaPosts.id }) : [];
  await audit(db, { type: "system", id: "media-writer" }, "media.drafted", { type: "media_week", id: week }, null, { pieces: saved.length, writer, error });
  return { week, drafts: saved.length, writer, ...(error ? { error } : {}) };
}

/* ───────────── decisions (cockpit and phone call the same functions) ───────────── */

/** The next time this piece may go out: its slot, or (slot passed) soon in working hours, never too close to another post. */
export async function nextFree(db: DbOrTx, p: Post, now: Date) {
  let at = p.scheduledFor && p.scheduledFor > now ? p.scheduledFor : new Date(now.getTime() + 10 * 60e3);
  const workday = (d: Date) => {
    const h = romeHour(d);
    return h < 8 || h >= 19 ? romeInstant(addDays(romeDay(new Date(d.getTime() + (h >= 19 ? 12 * HOUR : 0))), 0), "08:30") : d;
  };
  at = workday(at);
  if (p.channel !== "linkedin") return at;
  const gap = MEDIA.minGapHours * HOUR;
  const others = await db
    .select({ at: mediaPosts.scheduledFor })
    .from(mediaPosts)
    .where(and(eq(mediaPosts.channel, "linkedin"), inArray(mediaPosts.status, ["approved", "handed", "posted"]), ne(mediaPosts.id, p.id), isNotNull(mediaPosts.scheduledFor)))
    .orderBy(asc(mediaPosts.scheduledFor));
  for (let i = 0; i < 30; i++) {
    const clash = others.find((o) => Math.abs(o.at!.getTime() - at.getTime()) < gap);
    if (!clash) break;
    at = workday(new Date(clash.at!.getTime() + gap));
  }
  return at;
}

/** Approve (goes out at its slot) or reject (with an optional note the agent learns from). Only drafts. */
export async function decideMedia(db: Db, actor: Actor, id: string, approve: boolean, note?: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(mediaPosts).where(eq(mediaPosts.id, id)).for("update");
    if (!p) throw notFound("media post");
    if (p.status !== "draft") throw conflict(`already ${p.status}`);
    const set = approve
      ? { status: "approved", scheduledFor: await nextFree(tx, p, now) }
      : { status: "rejected", note: note?.slice(0, 500) ?? null };
    const [row] = await tx.update(mediaPosts).set({ ...set, decidedBy: actorRef(actor), decidedAt: now }).where(eq(mediaPosts.id, id)).returning();
    await audit(tx, actor, approve ? "media.approved" : "media.rejected", { type: "media_post", id }, { status: p.status }, { status: row.status, scheduledFor: row.scheduledFor?.toISOString() ?? null, note: row.note });
    return row;
  });
}

/** Edit text before (or after) approval; an approved piece goes back to draft, so what is published is what Javad saw. */
export async function editMedia(db: Db, actor: Actor, id: string, v: { title?: string; body: string }) {
  const body = v.body.trim();
  if (body.length < 20) throw new AppError(400, "invalid", "text too short");
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(mediaPosts).where(eq(mediaPosts.id, id)).for("update");
    if (!p) throw notFound("media post");
    if (!["draft", "approved"].includes(p.status)) throw conflict(`already ${p.status}`);
    const [row] = await tx.update(mediaPosts).set({ title: v.title?.trim() || p.title, body, status: "draft", decidedBy: null, decidedAt: null }).where(eq(mediaPosts.id, id)).returning();
    await audit(tx, actor, "media.edited", { type: "media_post", id }, { title: p.title, status: p.status }, { title: row.title, status: "draft" });
    return row;
  });
}

/** Javad confirms he posted a handed-over piece (or skips it). */
export async function confirmMediaPosted(db: Db, actor: Actor, id: string, posted: boolean, now = new Date()) {
  return db.transaction(async (tx) => {
    const [p] = await tx.update(mediaPosts).set(posted ? { status: "posted", publishedAt: now } : { status: "skipped" }).where(and(eq(mediaPosts.id, id), eq(mediaPosts.status, "handed"))).returning();
    if (!p) throw conflict("nothing waiting to be posted");
    if (posted) await emit(tx, actor, "media.published", { type: "media_post", id }, { channel: p.channel, lang: p.lang, theme: p.theme, via: "manual" });
    await audit(tx, actor, posted ? "media.posted" : "media.skipped", { type: "media_post", id }, { status: "handed" }, { status: p.status });
    return p;
  });
}

/* ───────────── publishing ───────────── */

/** Confirmed newsletter subscribers, one row per email (the newsletter sign-up, or a lead that ticked the newsletter). */
export async function subscribers(db: DbOrTx) {
  const rows = await db
    .select({ id: leads.id, email: leads.email, locale: leads.locale })
    .from(leads)
    .where(and(isNotNull(leads.confirmedAt), isNull(leads.unsubscribedAt), or(eq(leads.hook, "newsletter"), sql`'newsletter' = any(${leads.tags})`)))
    .orderBy(asc(leads.createdAt));
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.email) ? false : (seen.add(r.email), true)));
}

async function sendIssue(tx: DbOrTx, p: Post) {
  const issues = await tx.select({ lang: mediaPosts.lang }).from(mediaPosts).where(and(eq(mediaPosts.week, p.week), eq(mediaPosts.channel, "newsletter"), inArray(mediaPosts.status, ["approved", "sent"])));
  const covered = new Set(issues.map((i) => i.lang));
  const fallback = covered.has("en") ? "en" : p.lang;
  let n = 0;
  for (const s of await subscribers(tx)) {
    const lang = s.locale.slice(0, 2);
    // each subscriber gets the issue in their language, English (or the only issue) when theirs was not written
    if (lang !== p.lang && !(p.lang === fallback && !covered.has(lang))) continue;
    const unsub = leadUnsubscribeUrl(s.id);
    await queue(tx, { audience: "lead", email: s.email, locale: p.lang, name: "" }, "newsletter", { subject: p.title, body: p.body, link: ctaLink(p), unsubscribe: unsub }, undefined, "marketing", unsub);
    n++;
  }
  return n;
}

/** Every 10 minutes (outward, held by the emergency stop): approved pieces whose time has come go out. */
export async function publishDue(db: Db, publisher: SocialPublisher, now = new Date()) {
  const due = await db.select().from(mediaPosts).where(and(eq(mediaPosts.status, "approved"), lte(mediaPosts.scheduledFor, now))).orderBy(asc(mediaPosts.scheduledFor)).limit(10);
  const out = { posted: 0, handed: 0, sent: 0, recipients: 0, errors: [] as string[] };
  const actor: Actor = { type: "system", id: "media-publish" };
  for (const p of due) {
    try {
      if (p.channel === "newsletter") {
        await db.transaction(async (tx) => {
          const [mine] = await tx.update(mediaPosts).set({ status: "sending" }).where(and(eq(mediaPosts.id, p.id), eq(mediaPosts.status, "approved"))).returning();
          if (!mine) return;
          const n = await sendIssue(tx, p);
          await tx.update(mediaPosts).set({ status: "sent", publishedAt: now, recipients: n, publisher: "email" }).where(eq(mediaPosts.id, p.id));
          await emit(tx, actor, "media.published", { type: "media_post", id: p.id }, { channel: "newsletter", lang: p.lang, theme: p.theme, via: "email", recipients: n });
          await audit(tx, actor, "media.sent", { type: "media_post", id: p.id }, null, { recipients: n });
          out.sent++;
          out.recipients += n;
        });
        continue;
      }
      const r = await publisher.publish({ id: p.id, channel: p.channel as "linkedin" | "youtube", text: p.body, link: ctaLink(p) });
      await db.transaction(async (tx) => {
        if (r.mode === "posted") {
          await tx.update(mediaPosts).set({ status: "posted", publishedAt: now, publisher: publisher.provider, publishedRef: r.url ?? r.ref }).where(eq(mediaPosts.id, p.id));
          await emit(tx, actor, "media.published", { type: "media_post", id: p.id }, { channel: p.channel, lang: p.lang, theme: p.theme, via: publisher.provider });
          out.posted++;
        } else {
          // the phone gets the one-tap post with "posted / skip" buttons (phone-asks kind media)
          await tx.update(mediaPosts).set({ status: "handed", publisher: publisher.provider, publishedRef: r.shareUrl }).where(eq(mediaPosts.id, p.id));
          out.handed++;
        }
        await audit(tx, actor, r.mode === "posted" ? "media.posted" : "media.handed", { type: "media_post", id: p.id }, null, { provider: publisher.provider });
      });
    } catch (err) {
      out.errors.push(err instanceof Error ? err.message.slice(0, 200) : String(err));
    }
  }
  return out;
}

/** The one-tap link for a handed-over LinkedIn post (public redirect; the text is about to be public anyway). */
export async function shareUrlOf(db: Db, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const [p] = await db.select({ ref: mediaPosts.publishedRef, status: mediaPosts.status }).from(mediaPosts).where(eq(mediaPosts.id, id));
  return p && ["handed", "posted"].includes(p.status) && p.ref?.startsWith("https://") ? p.ref : null;
}

/* ───────────── what the media brings (Cockpit › Media, Systems, agent KPI) ───────────── */

export async function newSubscribers(db: DbOrTx, from: Date, to = new Date()) {
  const [r] = await db
    .select({ n: sql<number>`count(distinct ${leads.email})::int` })
    .from(leads)
    .where(and(isNotNull(leads.confirmedAt), gte(leads.createdAt, from), lte(leads.createdAt, to), or(eq(leads.hook, "newsletter"), sql`'newsletter' = any(${leads.tags})`)));
  return Number(r?.n ?? 0);
}

export async function mediaKpi(db: Db, now = new Date()) {
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const subs = (await subscribers(db)).length;
  const [ck] = await db.select({ n: sql<number>`count(*)::int` }).from(checkups).where(and(like(checkups.source, "media-%"), gte(checkups.createdAt, month)));
  const counts = await db.select({ status: mediaPosts.status, n: sql<number>`count(*)::int` }).from(mediaPosts).groupBy(mediaPosts.status);
  const by = (s: string) => Number(counts.find((c) => c.status === s)?.n ?? 0);
  const [postedMonth] = await db.select({ n: sql<number>`count(*)::int` }).from(mediaPosts).where(and(inArray(mediaPosts.status, ["posted", "sent"]), gte(mediaPosts.publishedAt, month)));
  const [lastIssue] = await db.select().from(mediaPosts).where(and(eq(mediaPosts.channel, "newsletter"), eq(mediaPosts.status, "sent"))).orderBy(desc(mediaPosts.publishedAt)).limit(1);
  return {
    subscribers: subs,
    subscribersGoal: MEDIA.goals.subscribers,
    newSubscribers30: await newSubscribers(db, new Date(now.getTime() - 30 * DAY), now),
    checkupsFromMedia: Number(ck?.n ?? 0),
    checkupsGoal: MEDIA.goals.checkupsPerMonth,
    publishedMonth: Number(postedMonth?.n ?? 0),
    drafts: by("draft"),
    approved: by("approved"),
    handed: by("handed"),
    lastIssue: lastIssue ? { at: lastIssue.publishedAt, recipients: lastIssue.recipients, subject: lastIssue.title } : null,
    spentEurMonth: await spentEur(db, "media-writer", month),
  };
}

/** The site's media page: LinkedIn posts that are out (posted by hand or by a provider), newest first, never before their time. */
export async function publicMedia(db: Db, now = new Date(), limit = 30) {
  return db
    .select({ id: mediaPosts.id, title: mediaPosts.title, body: mediaPosts.body, lang: mediaPosts.lang, theme: mediaPosts.theme, cta: mediaPosts.cta, industry: mediaPosts.industry, imageUrl: mediaPosts.imageUrl, sourceUrl: mediaPosts.sourceUrl, sourceTitle: mediaPosts.sourceTitle, publishedAt: mediaPosts.publishedAt })
    .from(mediaPosts)
    .where(and(eq(mediaPosts.channel, "linkedin"), eq(mediaPosts.status, "posted"), isNotNull(mediaPosts.publishedAt), lte(mediaPosts.publishedAt, now)))
    .orderBy(desc(mediaPosts.publishedAt))
    .limit(limit);
}

export async function mediaList(db: Db, limit = 80) {
  return db.select().from(mediaPosts).orderBy(desc(mediaPosts.week), asc(mediaPosts.channel), asc(mediaPosts.lang), asc(mediaPosts.position)).limit(limit);
}

export type { Cta, MediaChannel, MediaTheme };
