import { and, count, eq, gt, inArray, isNull, lt, notInArray, or } from "drizzle-orm";
import type { Db } from "@/db";
import { approvals, complaints, contracts, customerRequests, deliveries, experiments, orders, partnerDocuments, partnerMessages, partners, payouts, projectInputs, subscriptions, supplyGaps, touches } from "@/db/schema";

/*
 * One "Needs you" inbox (step 10): everything that waits for Javad, from every module, with where to act.
 * Order = what costs money or customers first. The same counts feed the menu badges.
 */

export type Need = { id: string; label: string; n: number; link: string; why: string };

export async function needsYou(db: Db, now = new Date()): Promise<Need[]> {
  const c = async (q: Promise<{ n: number }[]>) => Number((await q)[0]?.n ?? 0);
  const all: Need[] = [
    { id: "payouts", label: "Partner payouts due", n: await c(db.select({ n: count() }).from(payouts).where(and(eq(payouts.status, "due"), lt(payouts.dueAt, new Date(now.getTime() + 864e5))))), link: "/cockpit/finance", why: "fast pay is our promise to partners" },
    { id: "orders", label: "New orders to start (Send contract)", n: await c(db.select({ n: count() }).from(orders).where(eq(orders.status, "new"))), link: "/cockpit/projects", why: "a customer waits; target within a day" },
    { id: "complaints", label: "Complaints on your desk (founder step or overdue)", n: await c(db.select({ n: count() }).from(complaints).where(and(eq(complaints.status, "open"), or(eq(complaints.step, "founder"), lt(complaints.dueAt, now))))), link: "/cockpit/customers#complaints", why: "an unhappy customer is the fastest churn" },
    { id: "notices", label: "Customers who gave notice (call before it ends)", n: await c(db.select({ n: count() }).from(subscriptions).where(and(eq(subscriptions.status, "active"), gt(subscriptions.endsAt, now)))), link: "/cockpit/customers#notices", why: "30 days to win them back" },
    { id: "quotes", label: "Prices promised within 24 hours", n: await c(db.select({ n: count() }).from(customerRequests).where(and(eq(customerRequests.status, "open"), inArray(customerRequests.kind, ["solution", "change"])))), link: "/cockpit/customers", why: "we promised a price within 24 hours" },
    { id: "requests", label: "Customer requests to answer", n: await c(db.select({ n: count() }).from(customerRequests).where(and(eq(customerRequests.status, "open"), notInArray(customerRequests.kind, ["solution", "change"])))), link: "/cockpit/customers", why: "answer within a working day" },
    { id: "qa", label: "Deliveries to review", n: await c(db.select({ n: count() }).from(deliveries).where(eq(deliveries.status, "submitted"))), link: "/cockpit/qa", why: "the partner waits for money, the customer for the result" },
    { id: "inputs", label: "Customer files to check before partners see them", n: await c(db.select({ n: count() }).from(projectInputs).where(eq(projectInputs.status, "check"))), link: "/cockpit/projects", why: "partners are blocked until then" },
    { id: "content", label: "Website drafts to approve", n: await c(db.select({ n: count() }).from(approvals).where(eq(approvals.status, "pending"))), link: "/cockpit/approvals#content", why: "nothing public changes without you" },
    { id: "outreach", label: "Outreach messages to approve", n: await c(db.select({ n: count() }).from(touches).where(eq(touches.status, "draft"))), link: "/cockpit/outreach", why: "first message per company needs your OK" },
    { id: "experiments", label: "Finished tests to decide", n: await c(db.select({ n: count() }).from(experiments).where(eq(experiments.status, "ready"))), link: "/cockpit/experiments", why: "adopt the winner or keep the control" },
    { id: "applications", label: "Partner applications", n: await c(db.select({ n: count() }).from(partners).where(eq(partners.status, "applied"))), link: "/cockpit/partners", why: "decide within 3 days" },
    { id: "gaps", label: "Skills we lack (post the recruiting text, invite)", n: await c(db.select({ n: count() }).from(supplyGaps).where(and(eq(supplyGaps.status, "open"), isNull(supplyGaps.invitedAt)))), link: "/cockpit/partners#gaps", why: "work waits with nobody to do it" },
    { id: "documents", label: "Partner documents to check", n: await c(db.select({ n: count() }).from(partnerDocuments).where(eq(partnerDocuments.status, "pending"))), link: "/cockpit/partners", why: "a missing DPA blocks personal-data jobs" },
    { id: "moderation", label: "Masked or review-request messages", n: await c(db.select({ n: count() }).from(partnerMessages).where(and(eq(partnerMessages.author, "partner"), or(eq(partnerMessages.flagged, true), eq(partnerMessages.reviewRequest, true)), isNull(partnerMessages.readAt)))), link: "/cockpit/moderation", why: "bypass risk or a person asked for a human" },
    { id: "contracts", label: "Contracts unsigned > 3 days", n: await c(db.select({ n: count() }).from(contracts).where(and(eq(contracts.status, "sent"), lt(contracts.createdAt, new Date(now.getTime() - 3 * 864e5))))), link: "/cockpit/contracts", why: "nothing starts until it is signed: call them" },
  ];
  return all.filter((x) => x.n > 0);
}
