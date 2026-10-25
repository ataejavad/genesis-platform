import { createHash, createHmac, randomBytes } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, asc, eq, isNull, lt, sql } from "drizzle-orm";
import { CODE_WHAT, render, type Template } from "@/config/notify-copy";
import type { Db, DbOrTx } from "@/db";
import { account, companyProfile, contracts, deliveries, events, inviteTokens, invoices, jobs, leads, memberships, notifications, organizations, partners, payouts, user } from "@/db/schema";
import type { Actor } from "./actor";
import { AppError } from "./errors";
import { audit, emit } from "./events";
import type { Mailer } from "./mailer";

/*
 * One notification layer for everyone outside (step 8, doc 15; process map "notify.layer"):
 * event → recipient → template in their language → queued message → sent by the worker through the mailer.
 * Without a mailer key the messages stay queued and Javad sees them in Cockpit › Outbox (nothing is lost).
 * Transactional messages always go; marketing only with confirmed consent and a one-click unsubscribe.
 */

type Event = typeof events.$inferSelect;
const appUrl = () => (process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
const secret = () => process.env.BETTER_AUTH_SECRET ?? "dev-secret";

export const money = (n: number, lang = "en") => new Intl.NumberFormat({ it: "it-IT", de: "de-DE", fa: "fa-IR" }[lang.slice(0, 2)] ?? "en-GB", { style: "currency", currency: "EUR" }).format(n);
const day = (d: Date, lang = "en") => new Intl.DateTimeFormat({ it: "it-IT", de: "de-DE", fa: "fa-IR" }[lang.slice(0, 2)] ?? "en-GB", { dateStyle: "medium" }).format(d);

export async function ourName(db: DbOrTx) {
  const [c] = await db.select({ name: companyProfile.legalName }).from(companyProfile).where(eq(companyProfile.id, "main"));
  return c?.name || process.env.SITE_NAME || "Legend Partner";
}

type Recipient = { audience: "customer" | "partner" | "lead"; email: string; locale: string; name: string; orgId?: string | null; partnerId?: string | null };

/** Queues one message (in the caller's transaction when given one). One per event, template and address. */
export async function queue(db: DbOrTx, to: Recipient, template: Template, vars: Record<string, string | number | null | undefined>, eventId?: number, kind: "transactional" | "marketing" = "transactional", unsubscribeUrl?: string) {
  const { subject, body } = render(template, to.locale, { company: await ourName(db), name: to.name, ...vars });
  await db
    .insert(notifications)
    .values({ audience: to.audience, orgId: to.orgId ?? null, partnerId: to.partnerId ?? null, email: to.email, locale: to.locale.slice(0, 2), template, subject, body, kind, eventId: eventId ?? null, unsubscribeUrl: unsubscribeUrl ?? null })
    .onConflictDoNothing();
}

/** The people of a customer who get its messages (owners first). */
async function customerPeople(db: DbOrTx, orgId: string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  if (!org) return [];
  const people = await db.select({ id: user.id, name: user.name, email: user.email, role: memberships.role }).from(memberships).innerJoin(user, eq(user.id, memberships.userId)).where(eq(memberships.orgId, orgId));
  return people
    .filter((p) => !p.email.endsWith("@invalid"))
    .sort((a, b) => (a.role === "owner" ? -1 : 0) - (b.role === "owner" ? -1 : 0))
    .slice(0, 3)
    .map((p) => ({ audience: "customer" as const, email: p.email, locale: org.locale ?? "en", name: p.name, orgId, userId: p.id }));
}

async function partnerPerson(db: DbOrTx, partnerId: string) {
  const [p] = await db.select().from(partners).where(eq(partners.id, partnerId));
  return p ? { audience: "partner" as const, email: p.email, locale: p.locale, name: p.name.split(" ")[0], partnerId, userId: p.userId } : null;
}

/* ───────────── Invite links (set your password) ───────────── */

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createInvite(db: DbOrTx, userId: string, now = new Date()) {
  const token = randomBytes(24).toString("base64url");
  await db.insert(inviteTokens).values({ userId, tokenHash: sha(token), expiresAt: new Date(now.getTime() + 7 * 864e5) });
  return `${appUrl()}/welcome?token=${token}`;
}

/** Sets the password of an invited person; returns where they go next. */
export async function redeemInvite(db: Db, token: string, password: string, now = new Date()) {
  if (password.length < 12) throw new AppError(400, "weak_password", "at least 12 characters");
  return db.transaction(async (tx) => {
    const [t] = await tx.select().from(inviteTokens).where(eq(inviteTokens.tokenHash, sha(token))).for("update");
    if (!t || t.usedAt || t.expiresAt < now) throw new AppError(400, "invalid_link", "this link has expired; ask us for a new one");
    const hash = await hashPassword(password);
    const [acc] = await tx.select().from(account).where(and(eq(account.userId, t.userId), eq(account.providerId, "credential")));
    if (acc) await tx.update(account).set({ password: hash }).where(eq(account.id, acc.id));
    else await tx.insert(account).values({ id: randomBytes(16).toString("hex"), accountId: t.userId, providerId: "credential", userId: t.userId, password: hash });
    await tx.update(inviteTokens).set({ usedAt: now }).where(eq(inviteTokens.id, t.id));
    const [u] = await tx.select().from(user).where(eq(user.id, t.userId));
    await audit(tx, { type: "user", id: t.userId }, "user.password_set", { type: "user", id: t.userId }, null, null);
    return { email: u.email, next: u.role === "partner" ? "/partner/login" : "/portal/login" };
  });
}

/* ───────────── Lead confirmation (double opt-in) ───────────── */

export const leadToken = (id: string) => createHmac("sha256", secret()).update(`lead:${id}`).digest("base64url").slice(0, 32);
export const leadConfirmUrl = (id: string) => `${appUrl()}/api/v1/leads/confirm?id=${id}&t=${leadToken(id)}`;
const unsubToken = (id: string) => createHmac("sha256", secret()).update(`unsub:${id}`).digest("base64url").slice(0, 32);
export const leadUnsubscribeUrl = (id: string) => `${appUrl()}/api/v1/leads/unsubscribe?id=${id}&t=${unsubToken(id)}`;

/* ───────────── Event → message ───────────── */

/** Called by the worker for every event: who outside must hear about it, and with which message. */
export async function notifyEvent(db: Db, e: Event) {
  const p = e.payload as Record<string, unknown>;
  const id = e.subjectId;
  switch (e.type) {
    case "customer.created": {
      for (const r of await customerPeople(db, id!)) await queue(db, r, "invite", { link: await createInvite(db, r.userId) }, e.id);
      return;
    }
    case "contract.sent": {
      const [c] = await db.select().from(contracts).where(eq(contracts.id, id!));
      if (!c) return;
      if (c.kind === "customer" && c.orgId) {
        for (const r of await customerPeople(db, c.orgId)) await queue(db, r, "contract", { title: c.title, deposit: money(c.depositEur, r.locale), link: `${appUrl()}/portal/contract/${c.id}` }, e.id);
      } else if (c.partnerId) {
        const r = await partnerPerson(db, c.partnerId);
        if (r) await queue(db, r, "partnerContract", { link: `${appUrl()}/partner/contract/${c.id}`, invite: r.userId ? await createInvite(db, r.userId) : `${appUrl()}/partner/login` }, e.id);
      }
      return;
    }
    case "invoice.requested":
    case "invoice.reminded":
    case "invoice.issued": {
      const [inv] = await db.select().from(invoices).where(eq(invoices.id, id!));
      if (!inv) return;
      const [co] = await db.select().from(companyProfile).where(eq(companyProfile.id, "main"));
      const template: Template = e.type === "invoice.requested" ? "invoice" : e.type === "invoice.issued" ? "issued" : (`reminder${Math.min(4, Math.max(1, Number(p.level ?? 1)))}` as Template);
      for (const r of await customerPeople(db, inv.orgId))
        await queue(db, r, template, { title: inv.title, amount: money(inv.totalEur, r.locale), due: day(inv.dueAt, r.locale), reference: inv.reference, number: inv.number, holder: co?.legalName ?? (await ourName(db)), iban: co?.iban ?? "—", link: `${appUrl()}/portal/billing` }, e.id);
      return;
    }
    case "customer_approval.requested":
    case "milestone.reminded": {
      const orgId = (p.orgId as string | undefined) ?? null;
      const target = orgId ?? (e.type === "milestone.reminded" ? ((await db.execute(sql`select org_id from milestones where id = ${id}`)) as unknown as { org_id: string | null }[])[0]?.org_id : null);
      if (!target) return;
      for (const r of await customerPeople(db, target)) await queue(db, r, e.type === "milestone.reminded" ? "approvalReminder" : "approval", { title: String(p.title ?? ""), hours: Number(p.waitingHours ?? 24), auto: p.autoOn ? day(new Date(String(p.autoOn)), r.locale) : "", link: `${appUrl()}/portal` }, e.id);
      return;
    }
    case "milestone.auto_accepted": {
      if (!p.orgId) return;
      for (const r of await customerPeople(db, String(p.orgId))) await queue(db, r, "autoAccepted", { title: String(p.title ?? ""), link: `${appUrl()}/portal` }, e.id);
      return;
    }
    case "service.checked": {
      const [y, m] = String(p.period).split("-").map(Number);
      for (const r of await customerPeople(db, String(p.orgId))) {
        const month = new Intl.DateTimeFormat({ it: "it-IT", de: "de-DE", fa: "fa-IR" }[r.locale.slice(0, 2)] ?? "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 15)));
        await queue(db, r, "serviceChecked", { product: String(p.product ?? ""), title: String(p.title ?? ""), month, link: `${appUrl()}/portal` }, e.id);
      }
      return;
    }
    case "subscription.cancelled": {
      for (const r of await customerPeople(db, String(p.orgId))) await queue(db, r, "cancelConfirm", { product: String(p.product ?? ""), ends: day(new Date(String(p.endsAt)), r.locale), link: `${appUrl()}/portal` }, e.id);
      return;
    }
    case "job.rework": {
      // the partner who made it fixes it (included in the job): same message as changes asked on a delivery
      const r = await partnerPerson(db, String(p.partnerId));
      if (r) await queue(db, r, "changes", { title: String(p.title ?? ""), note: String(p.note ?? ""), link: `${appUrl()}/partner/work` }, e.id);
      return;
    }
    case "job.offered": {
      const r = await partnerPerson(db, String(p.partnerId));
      const [j] = await db.select({ pay: jobs.payEur }).from(jobs).where(eq(jobs.id, String(p.jobId)));
      if (r) await queue(db, r, "offer", { title: String(p.title ?? ""), pay: money(j?.pay ?? 0, r.locale), link: `${appUrl()}/partner/offers` }, e.id);
      return;
    }
    case "delivery.reviewed": {
      const r = await partnerPerson(db, String(p.partnerId));
      const [d] = await db.select({ review: deliveries.review, title: jobs.title }).from(deliveries).innerJoin(jobs, eq(jobs.id, deliveries.jobId)).where(eq(deliveries.id, id!));
      const [po] = await db.select({ dueAt: payouts.dueAt }).from(payouts).where(eq(payouts.jobId, String(p.jobId)));
      if (r && d) await queue(db, r, p.accepted ? "accepted" : "changes", { title: d.title, note: d.review ?? "", due: po ? day(po.dueAt, r.locale) : "", link: `${appUrl()}/partner/work` }, e.id);
      return;
    }
    case "payout.paid": {
      const r = await partnerPerson(db, String(p.partnerId));
      const [po] = await db.select({ title: jobs.title }).from(payouts).innerJoin(jobs, eq(jobs.id, payouts.jobId)).where(eq(payouts.id, id!));
      if (r) await queue(db, r, "payout", { amount: money(Number(p.amountEur ?? 0), r.locale), title: po?.title ?? "", link: `${appUrl()}/partner/earnings` }, e.id);
      return;
    }
    case "results.reported": {
      const [y, m] = String(p.month).split("-").map(Number);
      for (const r of await customerPeople(db, id!)) {
        const month = new Intl.DateTimeFormat({ it: "it-IT", de: "de-DE", fa: "fa-IR" }[r.locale.slice(0, 2)] ?? "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 15)));
        await queue(db, r, "monthlyReport", { month, eur: money(Number(p.eur ?? 0), r.locale), fee: money(Number(p.feeEur ?? 0), r.locale), total: money(Number(p.sinceStartEur ?? 0), r.locale), link: `${appUrl()}/portal` }, e.id);
      }
      return;
    }
    case "lead.reminder_due": {
      // marketing: only while consent stands (confirmed, not unsubscribed), always with a one-click unsubscribe
      const [l] = await db.select().from(leads).where(eq(leads.id, id!));
      if (!l?.confirmedAt || l.unsubscribedAt) return;
      const lang = l.locale.slice(0, 2);
      const t = (v: unknown) => (v && typeof v === "object" ? ((v as Record<string, string>)[lang] ?? (v as Record<string, string>).en ?? "") : String(v ?? ""));
      const unsub = leadUnsubscribeUrl(l.id);
      await queue(db, { audience: "lead", email: l.email, locale: l.locale, name: "" }, "deadlineReminder", { title: t(p.title), date: day(new Date(`${p.date}T12:00:00Z`), lang), days: Number(p.days ?? 30), what: t(p.what), offer: t(p.offer), link: `${appUrl()}/${lang}/hub/${l.industry}/${l.country.toLowerCase()}`, unsubscribe: unsub }, e.id, "marketing", unsub);
      return;
    }
    case "lead.captured": {
      const [l] = await db.select().from(leads).where(eq(leads.id, id!));
      if (!l || l.confirmedAt || l.unsubscribedAt) return;
      await queue(db, { audience: "lead", email: l.email, locale: l.locale, name: "" }, "leadConfirm", { what: l.hook, link: leadConfirmUrl(l.id) }, e.id);
      return;
    }
  }
}

/** The signing code goes only by email (never in an event, which n8n also receives). */
export async function queueCode(db: DbOrTx, to: { email: string; locale: string; name: string; orgId?: string | null; partnerId?: string | null; audience: "customer" | "partner" }, code: string, step: "sign" | "clauses") {
  const what = (CODE_WHAT[to.locale.slice(0, 2)] ?? CODE_WHAT.en)[step];
  const { subject, body } = render("code", to.locale, { company: await ourName(db), code, what, name: to.name });
  await db.insert(notifications).values({ audience: to.audience, orgId: to.orgId ?? null, partnerId: to.partnerId ?? null, email: to.email, locale: to.locale.slice(0, 2), template: "code", subject, body });
}

/* ───────────── Sending (worker) ───────────── */

export async function sendQueued(db: Db, mailer: Mailer, limit = 20, now = new Date()) {
  const due = await db.select().from(notifications).where(and(eq(notifications.status, "queued"), lt(notifications.attempts, 5))).orderBy(asc(notifications.createdAt)).limit(limit);
  for (const n of due) {
    try {
      await mailer.send({ to: n.email, subject: n.subject, text: n.body, unsubscribeUrl: n.unsubscribeUrl ?? undefined });
      await db.update(notifications).set({ status: "sent", sentAt: now, attempts: n.attempts + 1, error: null }).where(eq(notifications.id, n.id));
    } catch (err) {
      const failed = n.attempts + 1 >= 5;
      await db.update(notifications).set({ attempts: n.attempts + 1, error: err instanceof Error ? err.message.slice(0, 500) : "failed", status: failed ? "failed" : "queued" }).where(eq(notifications.id, n.id));
    }
  }
  return due.length;
}

export async function outbox(db: Db, limit = 100) {
  return db.select().from(notifications).orderBy(sql`${notifications.createdAt} desc`).limit(limit);
}

/** The unsubscribe link in every marketing email (and the mail client's one-click button). */
export async function unsubscribeLeadLink(db: Db, id: string, token: string, now = new Date()) {
  if (token !== unsubToken(id)) throw new AppError(400, "invalid_link", "invalid link");
  return db.transaction(async (tx) => {
    const [l] = await tx.update(leads).set({ unsubscribedAt: now }).where(and(eq(leads.id, id), isNull(leads.unsubscribedAt))).returning();
    if (l) await audit(tx, { type: "system", id: "unsubscribe" }, "lead.unsubscribed", { type: "lead", id }, null, { at: now.toISOString() });
    return l ?? (await tx.select().from(leads).where(eq(leads.id, id)))[0];
  });
}

/** Lead clicked the confirmation link: consent confirmed (double opt-in), and the lead joins the CRM. */
export async function confirmLead(db: Db, id: string, token: string, now = new Date()) {
  if (token !== leadToken(id)) throw new AppError(400, "invalid_link", "invalid link");
  return db.transaction(async (tx) => {
    const [l] = await tx.update(leads).set({ confirmedAt: now }).where(and(eq(leads.id, id), isNull(leads.confirmedAt))).returning();
    const actor: Actor = { type: "system", id: "double-opt-in" };
    const row = l ?? (await tx.select().from(leads).where(eq(leads.id, id)))[0];
    if (l) {
      await emit(tx, actor, "lead.confirmed", { type: "lead", id }, { industry: l.industry, country: l.country, hook: l.hook });
      await audit(tx, actor, "lead.confirmed", { type: "lead", id }, null, { at: now.toISOString() });
    }
    return row;
  });
}
