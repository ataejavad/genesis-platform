import { randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db, DbOrTx } from "@/db";
import { account, apiKeys, deliveries, jobOffers, jobs, memberships, organizations, partnerDocuments, partnerMessages, partners, partnerServices, payouts, user } from "@/db/schema";
import type { Actor } from "./actor";
import { createApiKey } from "./api-keys";
import { AppError, notFound } from "./errors";
import { customerCode as codeFor } from "./delivery-rules";
import { audit, emit } from "./events";
import { onJobAccepted, partnerMaterials } from "./projects";
import { maskContacts, match, SKILLS, type Stats, screen, tierOf } from "./partner-rules";

/*
 * Partner portal (step 6, doc 15 §6ب): apply → screening → active → offers (matched, with reasons) → accept →
 * deliver with a self-check against the job's checklist → our review → rating + payout due by level. Every
 * function that a partner calls takes the partner id from their session, never from the request.
 */

type PartnerRow = typeof partners.$inferSelect;
const SKILL_IDS = SKILLS.map((s) => s.id) as [string, ...string[]];

/* ───────────── Apply and screening ───────────── */

export const applyInput = z.object({
  kind: z.enum(["person", "company", "agent"]),
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(200),
  country: z.string().trim().length(2),
  languages: z.array(z.string().min(2).max(5)).max(8).default([]),
  skills: z.array(z.enum(SKILL_IDS)).min(1).max(8),
  links: z.array(z.string().url().max(500)).max(5).default([]),
  pitch: z.string().max(3000).optional(),
  locale: z.string().min(2).max(10).default("en"),
  consent: z.literal(true),
});

export async function openSkills(db: DbOrTx) {
  const rows = await db.select({ skills: jobs.skills }).from(jobs).where(inArray(jobs.status, ["open", "offered"]));
  return [...new Set(rows.flatMap((r) => r.skills))];
}

/** Public application (a conversation on the site). Screened by rules at once; Javad decides in the cockpit. */
export async function applyPartner(db: Db, input: z.input<typeof applyInput>) {
  const v = applyInput.parse(input);
  const email = v.email.toLowerCase();
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ id: partners.id, status: partners.status }).from(partners).where(eq(partners.email, email));
    if (existing) return { id: existing.id, duplicate: true };
    const screening = screen({ skills: v.skills, links: v.links, languages: v.languages, pitch: v.pitch ?? null }, await openSkills(tx));
    const [row] = await tx
      .insert(partners)
      .values({ kind: v.kind, name: v.name, email, country: v.country.toUpperCase(), languages: v.languages, skills: v.skills, links: v.links, pitch: v.pitch ?? null, locale: v.locale.slice(0, 2), screening, consentAt: new Date() })
      .returning();
    for (const link of v.links) await tx.insert(partnerDocuments).values({ partnerId: row.id, kind: "portfolio", link });
    const actor: Actor = { type: "system", id: "partner-apply" };
    await emit(tx, actor, "partner.applied", { type: "partner", id: row.id }, { name: v.name, kind: v.kind, country: row.country, skills: v.skills, score: screening.score });
    await audit(tx, actor, "partner.applied", { type: "partner", id: row.id }, null, { ...v, email });
    return { id: row.id, duplicate: false };
  });
}

/** Javad accepts (opens the partner's login; one-time password shown once) or rejects an application. */
export async function decideApplication(db: Db, actor: Actor, id: string, accept: boolean, password = randomBytes(12).toString("base64url")) {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(partners).where(eq(partners.id, id));
    if (!p) throw notFound("partner");
    if (p.status !== "applied") throw new AppError(409, "already_decided", "already decided");
    if (!accept) {
      await tx.update(partners).set({ status: "rejected", decidedAt: new Date() }).where(eq(partners.id, id));
      await audit(tx, actor, "partner.rejected", { type: "partner", id }, { status: p.status }, { status: "rejected" });
      return { password: "" };
    }
    const [org] = await tx.insert(organizations).values({ name: p.name, slug: `partner-${randomBytes(4).toString("hex")}`, kind: "partner", country: p.country, locale: p.locale }).returning();
    let [u] = await tx.select().from(user).where(eq(user.email, p.email));
    let pw = password;
    if (!u) {
      [u] = await tx.insert(user).values({ id: randomUUID(), name: p.name, email: p.email, emailVerified: true, role: "partner" }).returning();
      await tx.insert(account).values({ id: randomUUID(), accountId: u.id, providerId: "credential", userId: u.id, password: await hashPassword(pw) });
    } else pw = "";
    await tx.insert(memberships).values({ orgId: org.id, userId: u.id, role: "owner" }).onConflictDoNothing();
    await tx.update(partners).set({ status: "active", orgId: org.id, userId: u.id, decidedAt: new Date() }).where(eq(partners.id, id));
    await emit(tx, actor, "partner.activated", { type: "partner", id }, { name: p.name });
    await audit(tx, actor, "partner.activated", { type: "partner", id }, { status: p.status }, { status: "active" });
    return { password: pw };
  });
}

export async function partnerForUser(db: Db, userId: string) {
  const [p] = await db.select().from(partners).where(and(eq(partners.userId, userId), inArray(partners.status, ["active", "paused"])));
  return p ?? null;
}

export async function getPartner(db: DbOrTx, id: string) {
  const [p] = await db.select().from(partners).where(eq(partners.id, id));
  if (!p) throw notFound("partner");
  return p;
}

/** An agent partner works through the API: its key (scope partner:work) stands for the partner. */
export async function partnerForKey(db: Db, apiKeyId: string) {
  const [p] = await db.select().from(partners).where(and(eq(partners.apiKeyId, apiKeyId), inArray(partners.status, ["active", "paused"])));
  if (!p) throw new AppError(403, "forbidden", "this key belongs to no active partner");
  return p;
}

/** Gives an active partner an API key for its agent; the plain key is shown once. A new key replaces the old one. */
export async function issuePartnerKey(db: Db, actor: Actor, partnerId: string) {
  const p = await getPartner(db, partnerId);
  if (p.status !== "active" && p.status !== "paused") throw new AppError(409, "not_active", "partner is not active");
  const k = await createApiKey(db, { name: `partner:${p.name}`, scopes: ["partner:work"] });
  await db.transaction(async (tx) => {
    if (p.apiKeyId) await tx.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, p.apiKeyId));
    await tx.update(partners).set({ apiKeyId: k.id }).where(eq(partners.id, partnerId));
    await audit(tx, actor, "partner.key_issued", { type: "partner", id: partnerId }, { apiKeyId: p.apiKeyId }, { apiKeyId: k.id });
  });
  return k.key;
}

/* ───────────── Stats, level, earnings ───────────── */

export async function statsFor(db: DbOrTx, partnerId: string): Promise<Stats> {
  const [r] = await db
    .select({
      accepted: sql<number>`count(*) filter (where ${deliveries.status} = 'accepted')::int`,
      avg: sql<number | null>`avg(${deliveries.quality}) filter (where ${deliveries.status} = 'accepted')::float`,
      onTime: sql<number | null>`avg(case when ${deliveries.onTime} then 1.0 else 0.0 end) filter (where ${deliveries.status} = 'accepted')::float`,
    })
    .from(deliveries)
    .where(eq(deliveries.partnerId, partnerId));
  return { accepted: r.accepted, avgQuality: r.avg === null ? null : Math.round(r.avg * 10) / 10, onTimeRate: r.onTime === null ? null : Math.round(r.onTime * 100) / 100 };
}

export async function levelFor(db: DbOrTx, partnerId: string) {
  const stats = await statsFor(db, partnerId);
  return { stats, ...tierOf(stats) };
}

export async function earnings(db: Db, partnerId: string, now = new Date()) {
  const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const rows = await db
    .select({ payout: payouts, title: jobs.title })
    .from(payouts)
    .leftJoin(jobs, eq(jobs.id, payouts.jobId))
    .where(eq(payouts.partnerId, partnerId))
    .orderBy(desc(payouts.createdAt));
  const sum = (f: (p: (typeof rows)[number]["payout"]) => boolean) => rows.filter((r) => f(r.payout)).reduce((s, r) => s + r.payout.amountEur, 0);
  return {
    monthEur: sum((p) => p.createdAt >= month),
    dueEur: sum((p) => p.status === "due"),
    paidEur: sum((p) => p.status === "paid"),
    rows: rows.map((r) => ({ id: r.payout.id, title: r.title ?? "", amountEur: r.payout.amountEur, status: r.payout.status, dueAt: r.payout.dueAt.toISOString().slice(0, 10), paidAt: r.payout.paidAt?.toISOString().slice(0, 10) ?? null })),
  };
}

/* ───────────── Jobs, matching, offers ───────────── */

export const jobInput = z.object({
  title: z.string().trim().min(3).max(200),
  brief: z.string().trim().min(10).max(8000),
  kind: z.enum(["internal", "customer"]).default("internal"),
  customerOrgId: z.string().uuid().optional(),
  skills: z.array(z.enum(SKILL_IDS)).min(1).max(6),
  language: z.string().max(5).optional(),
  country: z.string().length(2).optional(),
  personalData: z.boolean().default(false),
  payEur: z.number().int().min(1).max(100000),
  priceEur: z.number().int().min(0).max(1000000).optional(),
  dueAt: z.coerce.date(),
  checklist: z.array(z.string().trim().min(3).max(300)).min(1).max(15),
});

export async function createJob(db: Db, actor: Actor, input: z.input<typeof jobInput>) {
  const v = jobInput.parse(input);
  return db.transaction(async (tx) => {
    let customerCode: string | null = null;
    if (v.kind === "customer") {
      if (!v.customerOrgId) throw new AppError(400, "invalid", "customer job needs a customer");
      const [o] = await tx.select().from(organizations).where(and(eq(organizations.id, v.customerOrgId), eq(organizations.kind, "customer")));
      if (!o) throw notFound("customer");
      // white-label: the partner sees a code, the trade and the country, never the name
      customerCode = codeFor(o.id, o.industry, o.country);
    }
    const [row] = await tx.insert(jobs).values({ ...v, customerOrgId: v.customerOrgId ?? null, customerCode, createdBy: `${actor.type}:${actor.id}` }).returning();
    await audit(tx, actor, "job.created", { type: "job", id: row.id }, null, v);
    return row;
  });
}

/** Partners the job can go to, best first, each with the score and its reasons. */
export async function matchesFor(db: DbOrTx, jobId: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) throw notFound("job");
  const active = await db.select().from(partners).where(eq(partners.status, "active"));
  // whoever made the work never checks it
  const maker = job.reviewsDeliveryId ? (await db.select({ p: deliveries.partnerId }).from(deliveries).where(eq(deliveries.id, job.reviewsDeliveryId)))[0]?.p : null;
  const out = [];
  for (const p of active) {
    if (p.id === maker) continue;
    const [load] = await db.select({ n: sql<number>`count(*)::int` }).from(jobs).where(and(eq(jobs.partnerId, p.id), inArray(jobs.status, ["assigned", "delivered"])));
    const [dpa] = await db.select({ n: sql<number>`count(*)::int` }).from(partnerDocuments).where(and(eq(partnerDocuments.partnerId, p.id), eq(partnerDocuments.kind, "dpa"), eq(partnerDocuments.status, "ok")));
    const m = match(job, { skills: p.skills, languages: p.languages, country: p.country, capacity: p.capacity, active: load.n, stats: await statsFor(db, p.id), dpaSigned: dpa.n > 0 });
    if (m) out.push({ partner: p, ...m });
  }
  return out.sort((a, b) => b.fit - a.fit);
}

/** Offers the job to the best `n` matches (Javad presses the button; the assignment agent can later). */
export async function offerJob(db: Db, actor: Actor, jobId: string, n = 3, minFit = 40) {
  return db.transaction(async (tx) => {
    const [job] = await tx.select().from(jobs).where(eq(jobs.id, jobId));
    if (!job) throw notFound("job");
    if (!["open", "offered"].includes(job.status)) throw new AppError(409, "not_open", "job is not open");
    const already = new Set((await tx.select({ p: jobOffers.partnerId }).from(jobOffers).where(eq(jobOffers.jobId, jobId))).map((r) => r.p));
    const picks = (await matchesFor(tx, jobId)).filter((m) => m.fit >= minFit && !already.has(m.partner.id)).slice(0, n);
    for (const m of picks) {
      const [o] = await tx.insert(jobOffers).values({ jobId, partnerId: m.partner.id, fit: m.fit, why: m.why }).returning();
      await emit(tx, actor, "job.offered", { type: "job_offer", id: o.id }, { jobId, partnerId: m.partner.id, title: job.title, fit: m.fit });
    }
    if (picks.length) await tx.update(jobs).set({ status: "offered" }).where(eq(jobs.id, jobId));
    await audit(tx, actor, "job.offered", { type: "job", id: jobId }, null, { partners: picks.map((m) => ({ id: m.partner.id, fit: m.fit })) });
    return picks.map((m) => ({ partnerId: m.partner.id, name: m.partner.name, fit: m.fit }));
  });
}

export async function offersFor(db: Db, partnerId: string) {
  return db
    .select({ offer: jobOffers, job: jobs })
    .from(jobOffers)
    .innerJoin(jobs, eq(jobs.id, jobOffers.jobId))
    .where(and(eq(jobOffers.partnerId, partnerId), eq(jobOffers.status, "offered")))
    .orderBy(desc(jobOffers.fit));
}

/** First partner to accept gets the job; the other offers are withdrawn. */
export async function respondOffer(db: Db, actor: Actor, partnerId: string, offerId: string, accept: boolean) {
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(jobOffers).where(and(eq(jobOffers.id, offerId), eq(jobOffers.partnerId, partnerId)));
    if (!o) throw notFound("offer");
    if (o.status !== "offered") throw new AppError(409, "gone", "offer no longer open");
    if (!accept) {
      await tx.update(jobOffers).set({ status: "declined", respondedAt: new Date() }).where(eq(jobOffers.id, offerId));
      await audit(tx, actor, "job_offer.declined", { type: "job_offer", id: offerId }, null, null);
      return { assigned: false };
    }
    // row lock: two partners pressing at the same moment cannot both get the job
    const [job] = await tx.select({ status: jobs.status, title: jobs.title }).from(jobs).where(eq(jobs.id, o.jobId)).for("update");
    if (!job || job.status !== "offered") {
      await tx.update(jobOffers).set({ status: "withdrawn" }).where(eq(jobOffers.id, offerId));
      throw new AppError(409, "taken", "job already taken");
    }
    await tx.update(jobs).set({ status: "assigned", partnerId }).where(eq(jobs.id, o.jobId));
    await tx.update(jobOffers).set({ status: "accepted", respondedAt: new Date() }).where(eq(jobOffers.id, offerId));
    await tx.update(jobOffers).set({ status: "withdrawn" }).where(and(eq(jobOffers.jobId, o.jobId), eq(jobOffers.status, "offered")));
    await emit(tx, actor, "job.assigned", { type: "job", id: o.jobId }, { partnerId, title: job.title });
    await audit(tx, actor, "job.assigned", { type: "job", id: o.jobId }, { status: "offered" }, { status: "assigned", partnerId });
    return { assigned: true };
  });
}

export async function workFor(db: Db, partnerId: string) {
  const rows = await db.select().from(jobs).where(eq(jobs.partnerId, partnerId)).orderBy(asc(jobs.dueAt));
  const ids = rows.map((r) => r.id);
  const dels = ids.length ? await db.select().from(deliveries).where(inArray(deliveries.jobId, ids)).orderBy(desc(deliveries.version)) : [];
  // what the customer gave, cleaned of their identity (step 7: customer → partner pipe)
  const mats = new Map<string, Awaited<ReturnType<typeof partnerMaterials>>>();
  for (const pid of new Set(rows.filter((r) => r.projectId && ["assigned", "delivered"].includes(r.status)).map((r) => r.projectId!))) mats.set(pid, await partnerMaterials(db, pid));
  return rows.map((j) => ({ job: j, last: dels.find((d) => d.jobId === j.id) ?? null, materials: (j.projectId && mats.get(j.projectId)) || [] }));
}

/* ───────────── Delivery and review ───────────── */

export const deliveryInput = z.object({ link: z.string().url().max(500), note: z.string().max(4000).optional(), selfCheck: z.array(z.boolean()).max(15) });

export async function deliver(db: Db, actor: Actor, partnerId: string, jobId: string, input: z.input<typeof deliveryInput>) {
  const v = deliveryInput.parse(input);
  return db.transaction(async (tx) => {
    const [job] = await tx.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.partnerId, partnerId)));
    if (!job) throw notFound("job");
    if (job.status !== "assigned") throw new AppError(409, "not_assigned", "job is not waiting for a delivery");
    // a QA partner's ticks are their verdict per criterion (unticked = fails); everyone else ticks every point
    if (v.selfCheck.length !== job.checklist.length || (job.role !== "qa" && v.selfCheck.some((x) => !x))) throw new AppError(400, "self_check", "tick every point of the checklist before delivering");
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(deliveries).where(eq(deliveries.jobId, jobId));
    const note = v.note ? maskContacts(v.note).shown : null;
    const [row] = await tx.insert(deliveries).values({ jobId, partnerId, version: n + 1, link: v.link, note, selfCheck: v.selfCheck }).returning();
    await tx.update(jobs).set({ status: "delivered" }).where(eq(jobs.id, jobId));
    const p = await getPartner(tx, partnerId);
    await emit(tx, actor, "delivery.submitted", { type: "delivery", id: row.id }, { jobId, title: job.title, partner: p.name, version: row.version });
    await audit(tx, actor, "delivery.submitted", { type: "delivery", id: row.id }, null, { jobId, link: v.link });
    return row;
  });
}

/** Our review: accepted → rating, job accepted, payout due by the partner's level; or changes asked. */
export async function reviewDelivery(db: Db, actor: Actor, deliveryId: string, accept: boolean, quality: number, review: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const [d] = await tx.select().from(deliveries).where(eq(deliveries.id, deliveryId));
    if (!d) throw notFound("delivery");
    if (d.status !== "submitted") throw new AppError(409, "already_reviewed", "already reviewed");
    const [job] = await tx.select().from(jobs).where(eq(jobs.id, d.jobId));
    const q = Math.max(1, Math.min(5, Math.round(quality)));
    const onTime = d.createdAt <= job.dueAt;
    await tx.update(deliveries).set({ status: accept ? "accepted" : "changes", review: review.slice(0, 4000) || null, quality: accept ? q : null, onTime: accept ? onTime : null, reviewedBy: `${actor.type}:${actor.id}`, reviewedAt: now }).where(eq(deliveries.id, deliveryId));
    await tx.update(jobs).set({ status: accept ? "accepted" : "assigned" }).where(eq(jobs.id, d.jobId));
    let payout = null;
    if (accept) {
      const lvl = await levelFor(tx, d.partnerId);
      [payout] = await tx.insert(payouts).values({ partnerId: d.partnerId, jobId: d.jobId, amountEur: job.payEur, dueAt: new Date(now.getTime() + lvl.tier.payoutDays * 864e5) }).returning();
      // a project task: cost booked, a finished milestone goes to the customer (step 7)
      await onJobAccepted(tx, actor, { ...job, status: "accepted" }, now);
    }
    await emit(tx, actor, "delivery.reviewed", { type: "delivery", id: deliveryId }, { jobId: d.jobId, partnerId: d.partnerId, accepted: accept, quality: accept ? q : null });
    await audit(tx, actor, "delivery.reviewed", { type: "delivery", id: deliveryId }, { status: "submitted" }, { status: accept ? "accepted" : "changes", quality: q, review });
    return { payout };
  });
}

export async function markPaid(db: Db, actor: Actor, payoutId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(payouts).where(eq(payouts.id, payoutId));
    if (!p) throw notFound("payout");
    if (p.status === "paid") return p;
    const [after] = await tx.update(payouts).set({ status: "paid", paidAt: now }).where(eq(payouts.id, payoutId)).returning();
    if (p.jobId) await tx.update(jobs).set({ status: "paid" }).where(eq(jobs.id, p.jobId));
    await emit(tx, actor, "payout.paid", { type: "payout", id: payoutId }, { partnerId: p.partnerId, amountEur: p.amountEur });
    await audit(tx, actor, "payout.paid", { type: "payout", id: payoutId }, { status: p.status }, { status: "paid" });
    return after;
  });
}

/* ───────────── Messages (masked) and human review requests ───────────── */

export async function sendPartnerMessage(db: Db, actor: Actor, partnerId: string, author: "partner" | "us", body: string, opts: { jobId?: string; reviewRequest?: boolean } = {}) {
  const text = body.trim().slice(0, 4000);
  if (!text) throw new AppError(400, "invalid", "empty message");
  return db.transaction(async (tx) => {
    const p = await getPartner(tx, partnerId);
    if (opts.jobId) {
      const [j] = await tx.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, opts.jobId), eq(jobs.partnerId, partnerId)));
      if (!j) throw notFound("job");
    }
    // what partners write is masked before anyone else reads it; we write to them unmasked
    const m = author === "partner" ? maskContacts(text) : { shown: text, flagged: false };
    const [row] = await tx.insert(partnerMessages).values({ partnerId, jobId: opts.jobId ?? null, author, body: text, shown: m.shown, flagged: m.flagged, reviewRequest: Boolean(opts.reviewRequest) }).returning();
    if (author === "partner") await emit(tx, actor, "partner.message", { type: "partner_message", id: row.id }, { partner: p.name, text: m.shown.slice(0, 300), flagged: m.flagged, reviewRequest: Boolean(opts.reviewRequest) });
    await audit(tx, actor, "partner.message", { type: "partner_message", id: row.id }, null, { author, flagged: m.flagged, reviewRequest: Boolean(opts.reviewRequest) });
    return row;
  });
}

export async function messagesFor(db: Db, partnerId: string) {
  return db.select().from(partnerMessages).where(eq(partnerMessages.partnerId, partnerId)).orderBy(asc(partnerMessages.createdAt)).limit(200);
}

/* ───────────── Today: what the partner should do now (Javad 2026-10-25) ───────────── */

export type TodayItem = {
  kind: "overdue" | "changes" | "dueToday" | "offer" | "dueSoon" | "message" | "doc" | "noDpa" | "payout";
  title: string;
  date: string | null;
  href: string;
  amountEur?: number;
};

// most urgent first: late work and asked changes, then today, offers, the next days, then the rest
const ORDER: TodayItem["kind"][] = ["overdue", "changes", "dueToday", "offer", "dueSoon", "message", "doc", "noDpa", "payout"];

/** The short list above the partner's chat: priorities and what is due, all from the partner's own data. */
export async function todayFor(db: Db, partnerId: string, now = new Date()): Promise<TodayItem[]> {
  const [work, offers, docs, msgs, pay] = await Promise.all([workFor(db, partnerId), offersFor(db, partnerId), documentsFor(db, partnerId, now), messagesFor(db, partnerId), earnings(db, partnerId, now)]);
  const day = (d: Date) => d.toISOString().slice(0, 10);
  const today = day(now);
  const soon = day(new Date(now.getTime() + 3 * 864e5));
  const items: TodayItem[] = [];
  for (const { job, last } of work.filter((w) => w.job.status === "assigned")) {
    const due = day(job.dueAt);
    const base = { title: job.title, date: due, href: "/partner/work" };
    if (last?.status === "changes") items.push({ kind: "changes", ...base });
    else if (due < today) items.push({ kind: "overdue", ...base });
    else if (due === today) items.push({ kind: "dueToday", ...base });
    else if (due <= soon) items.push({ kind: "dueSoon", ...base });
  }
  for (const { job } of offers) items.push({ kind: "offer", title: job.title, date: day(job.dueAt), href: "/partner/offers" });
  // a message from us after the partner last wrote is waiting for them
  const lastOurs = msgs.filter((m) => m.author === "us").at(-1);
  const lastTheirs = msgs.filter((m) => m.author === "partner").at(-1);
  if (lastOurs && (!lastTheirs || lastOurs.createdAt > lastTheirs.createdAt) && now.getTime() - lastOurs.createdAt.getTime() < 7 * 864e5) items.push({ kind: "message", title: lastOurs.shown.slice(0, 120), date: day(lastOurs.createdAt), href: "/partner/messages" });
  for (const d of docs.filter((x) => x.expiring && x.status !== "rejected")) items.push({ kind: "doc", title: d.kind, date: d.expiresAt ? day(d.expiresAt) : null, href: "/partner/profile" });
  if (!docs.some((d) => d.kind === "dpa" && d.status !== "rejected")) items.push({ kind: "noDpa", title: "dpa", date: null, href: "/partner/profile" });
  const nextPay = pay.rows.filter((r) => r.status === "due").sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0];
  if (nextPay) items.push({ kind: "payout", title: nextPay.title, date: nextPay.dueAt, href: "/partner/earnings", amountEur: nextPay.amountEur });
  return items.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || (a.date ?? "").localeCompare(b.date ?? ""));
}

/* ───────────── Profile: services, documents, capacity ───────────── */

export const serviceInput = z.object({ title: z.string().trim().min(3).max(200), skills: z.array(z.enum(SKILL_IDS)).max(6).default([]), priceModel: z.enum(["fixed", "hourly", "monthly"]), priceEur: z.number().int().min(1).max(100000), deliveryDays: z.number().int().min(1).max(365) });

export async function addService(db: Db, actor: Actor, partnerId: string, input: z.input<typeof serviceInput>) {
  const v = serviceInput.parse(input);
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(partnerServices).values({ ...v, partnerId }).returning();
    await audit(tx, actor, "partner_service.added", { type: "partner_service", id: row.id }, null, v);
    return row;
  });
}

export async function removeService(db: Db, actor: Actor, partnerId: string, id: string) {
  await db.transaction(async (tx) => {
    const [row] = await tx.update(partnerServices).set({ active: false }).where(and(eq(partnerServices.id, id), eq(partnerServices.partnerId, partnerId))).returning();
    if (!row) throw notFound("service");
    await audit(tx, actor, "partner_service.removed", { type: "partner_service", id }, null, null);
  });
}

export const DOC_KINDS = ["cv", "portfolio", "vat", "insurance", "contract", "nda", "dpa", "id"] as const;

export async function addDocument(db: Db, actor: Actor, partnerId: string, kind: string, link: string, expiresAt?: Date) {
  const v = z.object({ kind: z.enum(DOC_KINDS), link: z.string().url().max(500) }).parse({ kind, link });
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(partnerDocuments).values({ partnerId, kind: v.kind, link: v.link, expiresAt: expiresAt ?? null }).returning();
    await emit(tx, actor, "partner.document_added", { type: "partner_document", id: row.id }, { partnerId, kind: v.kind });
    await audit(tx, actor, "partner_document.added", { type: "partner_document", id: row.id }, null, v);
    return row;
  });
}

export async function checkDocument(db: Db, actor: Actor, id: string, ok: boolean, note?: string) {
  await db.transaction(async (tx) => {
    const [row] = await tx.update(partnerDocuments).set({ status: ok ? "ok" : "rejected", note: note ?? null }).where(eq(partnerDocuments.id, id)).returning();
    if (!row) throw notFound("document");
    await audit(tx, actor, "partner_document.checked", { type: "partner_document", id }, null, { ok, note });
  });
}

export async function documentsFor(db: Db, partnerId: string, now = new Date()) {
  const rows = await db.select().from(partnerDocuments).where(eq(partnerDocuments.partnerId, partnerId)).orderBy(desc(partnerDocuments.createdAt));
  // documents that expire within 30 days need renewing
  return rows.map((d) => ({ ...d, expiring: Boolean(d.expiresAt && d.expiresAt.getTime() - now.getTime() < 30 * 864e5) }));
}

export async function setCapacity(db: Db, actor: Actor, partnerId: string, capacity: number, paused: boolean) {
  const c = Math.max(0, Math.min(20, Math.round(capacity)));
  await db.transaction(async (tx) => {
    const p = await getPartner(tx, partnerId);
    await tx.update(partners).set({ capacity: c, status: p.status === "active" || p.status === "paused" ? (paused ? "paused" : "active") : p.status }).where(eq(partners.id, partnerId));
    await audit(tx, actor, "partner.capacity", { type: "partner", id: partnerId }, { capacity: p.capacity, status: p.status }, { capacity: c, paused });
  });
}

export async function servicesFor(db: Db, partnerId: string) {
  return db.select().from(partnerServices).where(and(eq(partnerServices.partnerId, partnerId), eq(partnerServices.active, true))).orderBy(asc(partnerServices.createdAt));
}

/* ───────────── Cockpit lists ───────────── */

export async function listPartners(db: Db) {
  const rows = await db.select().from(partners).orderBy(desc(partners.createdAt));
  return Promise.all(rows.map(async (p) => ({ partner: p, level: await levelFor(db, p.id) })));
}

export async function listJobs(db: Db) {
  return db.select({ job: jobs, partner: partners.name }).from(jobs).leftJoin(partners, eq(partners.id, jobs.partnerId)).orderBy(desc(jobs.createdAt)).limit(100);
}

export async function pendingDeliveries(db: Db) {
  return db
    .select({ delivery: deliveries, job: jobs, partner: partners.name })
    .from(deliveries)
    .innerJoin(jobs, eq(jobs.id, deliveries.jobId))
    .innerJoin(partners, eq(partners.id, deliveries.partnerId))
    .where(eq(deliveries.status, "submitted"))
    .orderBy(asc(deliveries.createdAt));
}

export async function duePayouts(db: Db) {
  return db.select({ payout: payouts, partner: partners.name, title: jobs.title }).from(payouts).innerJoin(partners, eq(partners.id, payouts.partnerId)).leftJoin(jobs, eq(jobs.id, payouts.jobId)).where(eq(payouts.status, "due")).orderBy(asc(payouts.dueAt));
}

export async function partnerInbox(db: Db, since = new Date(Date.now() - 30 * 864e5)) {
  return db.select({ message: partnerMessages, partner: partners.name }).from(partnerMessages).innerJoin(partners, eq(partners.id, partnerMessages.partnerId)).where(gte(partnerMessages.createdAt, since)).orderBy(desc(partnerMessages.createdAt)).limit(100);
}

export type { PartnerRow };

export async function setPartnerLocale(db: Db, actor: Actor, partnerId: string, locale: string) {
  await db.transaction(async (tx) => {
    const p = await getPartner(tx, partnerId);
    await tx.update(partners).set({ locale }).where(eq(partners.id, partnerId));
    await audit(tx, actor, "partner.locale", { type: "partner", id: partnerId }, { locale: p.locale }, { locale });
  });
}
