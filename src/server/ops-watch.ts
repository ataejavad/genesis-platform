import { and, eq, gte, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import type { Db } from "@/db";
import { changeRequests, contracts, organizations, customerApprovals, customerRequests, deliveries, events, jobOffers, jobs, mediaPosts, orders, radarItems, partnerDocuments, partners, payouts, projectInputs } from "@/db/schema";
import { MAX_ATTEMPTS } from "@/worker/dispatch";
import { MEDIA } from "@/config/media";
import { RADAR } from "@/config/radar";
import type { Actor } from "./actor";
import { emit } from "./events";
import { overdueComplaints } from "./complaints";
import { realJob, realOrder, realOrg, realPartner, realProject } from "./demo";
import { offerJob } from "./partners";
import { lowMargins, notices } from "./service";
import { recruitFor } from "./supply";

/*
 * Ops watchdog (process auditor at run time). Every hour it looks for work that stopped moving: jobs nobody
 * took, offers nobody answered, money due, people waiting on us. What it can fix itself it fixes (re-offers);
 * the rest goes to Javad as one Telegram digest, each item at most once a day. Limits live in WATCH.
 * Demo/test records (./demo) are never flagged. Every item says in plain words what to do next.
 */

const HOUR = 36e5;
export const WATCH = {
  offerStaleHours: 48, // an offer nobody answered is withdrawn and the next best partners get it
  requestHours: 24, // customer request answered within a working day
  applicationHours: 72, // partner application decided within 3 days
  qaHours: 24, // delivery reviewed within a day (partner waits for money)
  approvalHours: 48, // change requests and other customer approvals (milestones have their own reminder)
  orderHours: 24, // a new order becomes a project within a day
  inputHours: 24, // a customer file waiting for our check blocks the partners
  contractHours: 72, // a contract sent and not signed: nothing starts until it is (call them)
  payoutLeadHours: 24, // payout due tomorrow or overdue
  documentDays: 14, // partner document expires soon
  repeatHours: 24, // the same item is flagged at most once a day
};

export type OpsItem = { key: string; kind: string; text: string; link: string };

const age = (now: Date, d: Date) => Math.round((now.getTime() - d.getTime()) / HOUR);

/** Re-offers stalled jobs and collects every item that waits too long. Pure reads except re-offers and the digest event. */
export async function opsWatch(db: Db, now = new Date()) {
  const actor: Actor = { type: "system", id: "ops-watch" };
  const items: OpsItem[] = [];
  const before = (h: number) => new Date(now.getTime() - h * HOUR);
  let reoffered = 0;

  // 1. Jobs: offers nobody answered expire; declined or expired jobs go to the next matches; no match = supply gap.
  const stuck = await db.select().from(jobs).where(and(inArray(jobs.status, ["open", "offered"]), realJob(jobs.id)));
  for (const j of stuck) {
    if (j.status === "open" && !j.projectId && !j.subscriptionId) continue; // ad-hoc jobs wait for Javad's "offer" button
    const offers = await db.select().from(jobOffers).where(eq(jobOffers.jobId, j.id));
    const pending = offers.filter((o) => o.status === "offered");
    const stale = pending.filter((o) => o.createdAt < before(WATCH.offerStaleHours));
    const needsOffer = j.status === "open" || pending.length === 0 || stale.length === pending.length;
    if (!needsOffer) continue;
    if (stale.length) await db.update(jobOffers).set({ status: "expired", respondedAt: now }).where(inArray(jobOffers.id, stale.map((o) => o.id)));
    const picks = await offerJob(db, actor, j.id).catch(() => []);
    if (picks.length) reoffered++;
    else {
      if (j.status === "offered") await db.update(jobs).set({ status: "open" }).where(and(eq(jobs.id, j.id), eq(jobs.status, "offered")));
      // the recruiting action starts by itself: a post to publish and earlier applicants to decide or invite back
      const gaps = await recruitFor(db, j);
      items.push({ key: `no_match:${j.id}`, kind: "no_match", text: `No partner for "${j.title}" (${j.skills.join(", ") || "no skills"}${j.language ? `, ${j.language}` : ""}). To do: ${gaps.length ? "publish the ready recruiting post" : "invite a partner"} in Cockpit › Partners, or do it ourselves`, link: "/cockpit/partners#gaps" });
    }
  }

  // 2. Late tasks (due date passed, not delivered).
  const late = await db.select({ id: jobs.id, title: jobs.title, dueAt: jobs.dueAt }).from(jobs).where(and(inArray(jobs.status, ["open", "offered", "assigned"]), lt(jobs.dueAt, now), realJob(jobs.id)));
  for (const t of late) items.push({ key: `late:${t.id}`, kind: "late", text: `Task "${t.title}" is ${age(now, t.dueAt)}h late. To do: ask the partner for a date or give it to another partner`, link: "/cockpit/projects" });

  // 3. Money we owe partners (fast payouts are our promise to them).
  const due = await db.select({ p: payouts, name: partners.name }).from(payouts).innerJoin(partners, eq(partners.id, payouts.partnerId)).where(and(eq(payouts.status, "due"), lt(payouts.dueAt, new Date(now.getTime() + WATCH.payoutLeadHours * HOUR)), eq(partners.demo, false)));
  for (const d of due) items.push({ key: `payout:${d.p.id}`, kind: "payout", text: `${d.p.dueAt < now ? "OVERDUE payout" : "Payout due tomorrow"}: €${d.p.amountEur} to ${d.name}. To do: pay it by bank transfer, then mark it paid in Cockpit › Finance`, link: "/cockpit/partners" });

  // 4. People waiting on us.
  const reqs = await db.select({ id: customerRequests.id, kind: customerRequests.kind, at: customerRequests.createdAt }).from(customerRequests).where(and(eq(customerRequests.status, "open"), lt(customerRequests.createdAt, before(WATCH.requestHours)), realOrg(customerRequests.orgId)));
  for (const r of reqs) items.push({ key: `request:${r.id}`, kind: "request", text: r.kind === "solution" || r.kind === "change" ? `We promised a price in 24h, now ${age(now, r.at)}h: ${r.kind === "change" ? "extra change" : "new problem"} not quoted. To do: send the price in Cockpit › Customers` : `Customer request (${r.kind}) unanswered for ${age(now, r.at)}h. To do: answer it in Cockpit › Customers`, link: "/cockpit/customers" });

  // complaint steps past their deadline (free fix 3 days, new partner 7 days, Javad 1 working day)
  for (const c of await overdueComplaints(db, now)) if (!c.demo) items.push({ key: `complaint:${c.c.id}:${c.c.step}`, kind: "complaint", text: `Complaint of ${c.company} past its ${c.c.step} deadline. To do: ${c.c.step === "founder" ? "call them today" : "move it to the next step or close it"}`, link: "/cockpit/customers" });

  // media: a week of drafts nobody decided loses its slots; a post handed over and never confirmed may not be live
  const mediaDrafts = await db.select({ id: mediaPosts.id }).from(mediaPosts).where(and(eq(mediaPosts.status, "draft"), lt(mediaPosts.createdAt, before(MEDIA.draftHours))));
  if (mediaDrafts.length) items.push({ key: `media_drafts:${now.toISOString().slice(0, 10)}`, kind: "media", text: `${mediaDrafts.length} media drafts wait for your OK for over ${MEDIA.draftHours / 24} days (this week's posts and newsletter)`, link: "/cockpit/media" });
  const handed = await db.select({ id: mediaPosts.id, title: mediaPosts.title, channel: mediaPosts.channel }).from(mediaPosts).where(and(eq(mediaPosts.status, "handed"), lt(mediaPosts.updatedAt, before(MEDIA.handedHours))));
  for (const h of handed) items.push({ key: `media_handed:${h.id}`, kind: "media", text: `${h.channel === "linkedin" ? "LinkedIn post" : "Video"} "${h.title}" not confirmed as posted for ${MEDIA.handedHours / 24} days: post it or skip it`, link: `/cockpit/media#${h.id}` });

  // radar: proposals are news; undecided after RADAR.decideHours they lose their value
  const radarWaiting = await db.select({ id: radarItems.id }).from(radarItems).where(and(eq(radarItems.status, "proposed"), lt(radarItems.createdAt, before(RADAR.decideHours))));
  if (radarWaiting.length) items.push({ key: `radar:${now.toISOString().slice(0, 10)}`, kind: "radar", text: `${radarWaiting.length} new solutions from the radar wait for keep / dismiss for over ${RADAR.decideHours / 24} days`, link: "/cockpit/radar" });

  const apps = await db.select({ id: partners.id, name: partners.name, at: partners.createdAt }).from(partners).where(and(eq(partners.status, "applied"), lt(partners.createdAt, before(WATCH.applicationHours)), eq(partners.demo, false)));
  for (const a of apps) items.push({ key: `application:${a.id}`, kind: "application", text: `Partner application from ${a.name} waits ${Math.round(age(now, a.at) / 24)} days. To do: accept or reject it in Cockpit › Partners`, link: "/cockpit/partners" });

  const qa = await db.select({ id: deliveries.id, at: deliveries.createdAt, title: jobs.title }).from(deliveries).innerJoin(jobs, eq(jobs.id, deliveries.jobId)).where(and(eq(deliveries.status, "submitted"), lt(deliveries.createdAt, before(WATCH.qaHours)), realPartner(deliveries.partnerId), realJob(deliveries.jobId)));
  for (const d of qa) items.push({ key: `qa:${d.id}`, kind: "qa", text: `A partner delivered "${d.title}" ${age(now, d.at)}h ago and waits for your review. To do: accept it or ask for changes in Cockpit › QA`, link: "/cockpit/qa" });

  const newOrders = await db.select({ id: orders.id, company: orders.company, at: orders.createdAt }).from(orders).where(and(eq(orders.status, "new"), lt(orders.createdAt, before(WATCH.orderHours)), eq(orders.demo, false), realOrg(orders.orgId)));
  for (const o of newOrders) items.push({ key: `order:${o.id}`, kind: "order", text: `New order${o.company ? ` from ${o.company}` : ""} waits ${age(now, o.at)}h. To do: press "Send contract" in Cockpit › Projects (or reject it)`, link: "/cockpit/projects" });

  const unsigned = await db.select({ id: contracts.id, title: contracts.title, kind: contracts.kind, at: contracts.createdAt }).from(contracts).where(and(eq(contracts.status, "sent"), lt(contracts.createdAt, before(WATCH.contractHours)), realOrg(contracts.orgId), realPartner(contracts.partnerId), realOrder(contracts.orderId)));
  for (const c of unsigned) items.push({ key: `contract:${c.id}`, kind: "contract", text: `${c.kind === "customer" ? "Customer" : "Partner"} contract "${c.title}" not signed for ${Math.round(age(now, c.at) / 24)} days. To do: call them and ask them to sign`, link: `/cockpit/contracts/${c.id}` });

  const files = await db.select({ id: projectInputs.id, label: projectInputs.label, at: projectInputs.createdAt }).from(projectInputs).where(and(eq(projectInputs.status, "check"), lt(projectInputs.createdAt, before(WATCH.inputHours)), realOrg(projectInputs.orgId), realProject(projectInputs.projectId)));
  for (const f of files) items.push({ key: `input:${f.id}`, kind: "input", text: `Customer file "${f.label}" waits for your check ${age(now, f.at)}h and partners are blocked. To do: check it in Cockpit › Projects`, link: "/cockpit/projects" });

  // 5. Customers we wait on (milestones have their own daily reminder in deliveryWatch).
  const waiting = await db.select({ id: customerApprovals.id, title: customerApprovals.title, at: customerApprovals.createdAt }).from(customerApprovals).where(and(eq(customerApprovals.status, "pending"), isNull(customerApprovals.milestoneId), lt(customerApprovals.createdAt, before(WATCH.approvalHours)), realOrg(customerApprovals.orgId)));
  for (const w of waiting) items.push({ key: `approval:${w.id}`, kind: "approval", text: `The customer has not answered our question "${w.title}" for ${age(now, w.at)}h. To do: send them a short reminder or call them`, link: "/cockpit/customers" });
  const quoted = await db.select({ id: changeRequests.id }).from(changeRequests).where(and(eq(changeRequests.status, "quoted"), lt(changeRequests.createdAt, before(WATCH.approvalHours * 2)), realOrg(changeRequests.orgId)));
  for (const q of quoted) items.push({ key: `change:${q.id}`, kind: "approval", text: "We sent a price for an extra change 4 days ago, no answer. To do: call the customer", link: "/cockpit/projects" });

  // Monthly service: customers who cost more than the margin floor allows; notices to answer with a call.
  const demoOrgs = new Set((await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.demo, true))).map((o) => o.id));
  for (const m of await lowMargins(db, now)) if (!demoOrgs.has(m.orgId)) items.push({ key: `margin:${m.orgId}:${now.toISOString().slice(0, 7)}`, kind: "margin", text: `Margin ${m.marginPct}% on a €${m.feeEur}/month customer (cost €${Math.round(m.costEur)}${m.estimated ? ", partly estimated" : ""}). To do: raise the price or cut the cost`, link: "/cockpit/customers" });
  for (const n of await notices(db, now)) if (!n.demo) items.push({ key: `notice:${n.s.id}`, kind: "churn", text: `${n.company} gave notice (${n.s.cancelReason ?? "no reason"}), ends ${n.s.endsAt!.toISOString().slice(0, 10)}. To do: call them to win them back`, link: "/cockpit/customers#notices" });

  // 6. Partner documents about to expire (a lapsed DPA blocks personal-data jobs).
  const docs = await db.select({ id: partnerDocuments.id, kind: partnerDocuments.kind, name: partners.name, exp: partnerDocuments.expiresAt }).from(partnerDocuments).innerJoin(partners, eq(partners.id, partnerDocuments.partnerId)).where(and(isNotNull(partnerDocuments.expiresAt), lt(partnerDocuments.expiresAt, new Date(now.getTime() + WATCH.documentDays * 24 * HOUR)), eq(partners.status, "active"), eq(partners.demo, false)));
  for (const d of docs) items.push({ key: `doc:${d.id}`, kind: "document", text: `${d.name}: ${d.kind} ${d.exp! < now ? "expired" : "expires"} ${d.exp!.toISOString().slice(0, 10)}. To do: ask the partner for a new one`, link: "/cockpit/partners" });

  // 7. The system itself: events that failed every retry never reached Telegram or n8n.
  const dead = await db.select({ id: events.id, type: events.type, err: events.lastError }).from(events).where(and(isNull(events.dispatchedAt), gte(events.attempts, MAX_ATTEMPTS)));
  for (const e of dead) items.push({ key: `dead:${e.id}`, kind: "system", text: `A system message (${e.type} #${e.id}) failed ${MAX_ATTEMPTS}×: ${String(e.err ?? "").slice(0, 80)}. To do: forward this to Claude to fix`, link: "/cockpit" });

  // One digest of new items; an item already flagged in the last day is not repeated.
  const recent = await db.select({ payload: events.payload }).from(events).where(and(eq(events.type, "ops.flagged"), gte(events.createdAt, before(WATCH.repeatHours))));
  const seen = new Set(recent.flatMap((r) => ((r.payload.items as OpsItem[] | undefined) ?? []).map((i) => i.key)));
  const fresh = items.filter((i) => !seen.has(i.key));
  if (fresh.length) {
    await db.transaction((tx) => emit(tx, actor, "ops.flagged", { type: "ops", id: now.toISOString() }, { items: fresh, counts: countBy(items) }));
  }
  return { reoffered, open: items.length, flagged: fresh.length, counts: countBy(items), items };
}

const countBy = (items: OpsItem[]) => items.reduce<Record<string, number>>((m, i) => ((m[i.kind] = (m[i.kind] ?? 0) + 1), m), {});

