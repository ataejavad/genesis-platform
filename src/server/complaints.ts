import { and, desc, eq, inArray, lt } from "drizzle-orm";
import type { Db } from "@/db";
import { complaints, customerApprovals, jobs, milestones, organizations, projects } from "@/db/schema";
import type { Actor } from "./actor";
import { AppError, notFound } from "./errors";
import { audit, emit } from "./events";
import { createRequest } from "./portal";
import { reworkJob } from "./projects";

/*
 * Complaint path (marketplace lesson 2026-10-25, Toptal/Fiverr): "I'm not satisfied" in the chat climbs one ladder,
 * each step with a deadline: 1. free fix by the same partner → 2. another partner redoes it (we pay, not the customer)
 * → 3. Javad personally. Accepting the fixed milestone ends it; ops-watch flags a step past its deadline.
 */

const DAY = 864e5;
export const LADDER = { fix: 3 * DAY, swap: 7 * DAY, founder: DAY } as const;
export type Step = keyof typeof LADDER;
const NEXT: Record<Step, Step | null> = { fix: "swap", swap: "founder", founder: null };

/** The milestone a complaint is about: the newest one the customer has seen (waiting, being fixed, or accepted). */
async function lastHandOver(db: Db, orgId: string) {
  const [row] = await db
    .select({ m: milestones, p: projects })
    .from(milestones)
    .innerJoin(projects, eq(projects.id, milestones.projectId))
    .where(and(eq(milestones.orgId, orgId), inArray(milestones.status, ["ready", "changes", "accepted"])))
    .orderBy(desc(milestones.readyAt))
    .limit(1);
  return row ?? null;
}

export async function openComplaintFor(db: Db, orgId: string) {
  const [c] = await db.select().from(complaints).where(and(eq(complaints.orgId, orgId), eq(complaints.status, "open"))).orderBy(desc(complaints.createdAt)).limit(1);
  return c ?? null;
}

/** "Not satisfied": a new complaint starts at the free fix; an open one climbs to its next step. */
export async function complain(db: Db, actor: Actor, orgId: string, userId: string | null, text: string, now = new Date()) {
  const body = text.trim().slice(0, 2000);
  if (body.length < 2) throw new AppError(400, "invalid", "empty complaint");
  const open = await openComplaintFor(db, orgId);
  if (open) return escalate(db, actor, open.id, body, now);
  const target = await lastHandOver(db, orgId);
  // nothing delivered yet: it is a support question for the team, answered within a working day
  if (!target) {
    await createRequest(db, actor, orgId, userId, "support", body);
    return { step: "support" as const, dueAt: new Date(now.getTime() + DAY) };
  }
  return db.transaction(async (tx) => {
    const { m, p } = target;
    // the hand-over is reopened for the fix; the pending OK (if any) is closed with the complaint as its note
    if (m.approvalId) await tx.update(customerApprovals).set({ status: "changes", note: body, decidedBy: `${actor.type}:${actor.id}`, decidedAt: now }).where(and(eq(customerApprovals.id, m.approvalId), eq(customerApprovals.status, "pending")));
    await tx.update(milestones).set({ status: "changes" }).where(eq(milestones.id, m.id));
    const job = await reworkJob(tx, actor, m, p, body, "fix", now);
    const [c] = await tx.insert(complaints).values({ orgId, projectId: p.id, milestoneId: m.id, text: body, step: "fix", jobId: job?.id ?? null, dueAt: new Date(now.getTime() + LADDER.fix) }).returning();
    const [org] = await tx.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId));
    await emit(tx, actor, "complaint.opened", { type: "complaint", id: c.id }, { orgId, company: org?.name, code: p.code, title: m.title, text: body.slice(0, 300), step: "fix" });
    await audit(tx, actor, "complaint.opened", { type: "complaint", id: c.id }, null, { milestoneId: m.id, jobId: job?.id ?? null });
    return { step: "fix" as const, dueAt: c.dueAt, complaintId: c.id };
  });
}

/** One step up: the fix did not help → another partner; that did not help → Javad. */
export async function escalate(db: Db, actor: Actor, complaintId: string, text = "", now = new Date()) {
  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(complaints).where(eq(complaints.id, complaintId)).for("update");
    if (!c) throw notFound("complaint");
    if (c.status !== "open") throw new AppError(409, "closed", "complaint already resolved");
    const step = NEXT[c.step as Step];
    // already with Javad: the new words are added for him, the deadline stays
    if (!step) {
      await tx.update(complaints).set({ text: `${c.text}\n---\n${text}`.slice(0, 4000) }).where(eq(complaints.id, c.id));
      await emit(tx, actor, "complaint.escalated", { type: "complaint", id: c.id }, { orgId: c.orgId, step: "founder", text: text.slice(0, 300), again: true });
      return { step: "founder" as const, dueAt: c.dueAt, complaintId: c.id };
    }
    let jobId = c.jobId;
    if (step === "swap" && c.milestoneId) {
      const [m] = await tx.select().from(milestones).where(eq(milestones.id, c.milestoneId));
      const [p] = await tx.select().from(projects).where(eq(projects.id, m.projectId));
      if (c.jobId) await tx.update(jobs).set({ status: "cancelled" }).where(and(eq(jobs.id, c.jobId), inArray(jobs.status, ["open", "offered", "assigned", "delivered"])));
      if (m.status !== "changes") await tx.update(milestones).set({ status: "changes" }).where(eq(milestones.id, m.id));
      jobId = (await reworkJob(tx, actor, { ...m, status: "changes" }, p, [c.text, text].filter(Boolean).join("\n"), "swap", now))?.id ?? null;
    }
    const [after] = await tx.update(complaints).set({ step, jobId, dueAt: new Date(now.getTime() + LADDER[step]), text: text ? `${c.text}\n---\n${text}`.slice(0, 4000) : c.text }).where(eq(complaints.id, c.id)).returning();
    const [org] = await tx.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, c.orgId));
    await emit(tx, actor, "complaint.escalated", { type: "complaint", id: c.id }, { orgId: c.orgId, company: org?.name, step, text: (text || c.text).slice(0, 300) });
    await audit(tx, actor, "complaint.escalated", { type: "complaint", id: c.id }, { step: c.step }, { step, jobId });
    return { step, dueAt: after.dueAt, complaintId: c.id };
  });
}

/** Javad closes it (called the customer, refunded, agreed something); the note stays for the record. */
export async function resolveComplaint(db: Db, actor: Actor, complaintId: string, note: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const [c] = await tx.update(complaints).set({ status: "resolved", resolvedAt: now, resolvedBy: `${actor.type}:${actor.id}`, note: note.trim().slice(0, 2000) || null }).where(and(eq(complaints.id, complaintId), eq(complaints.status, "open"))).returning();
    if (!c) throw notFound("complaint");
    await emit(tx, actor, "complaint.resolved", { type: "complaint", id: c.id }, { orgId: c.orgId, step: c.step });
    await audit(tx, actor, "complaint.resolved", { type: "complaint", id: c.id }, { status: "open" }, { status: "resolved", note });
    return c;
  });
}

export async function listComplaints(db: Db, statuses = ["open"]) {
  return db.select({ c: complaints, company: organizations.name, code: projects.code }).from(complaints).innerJoin(organizations, eq(organizations.id, complaints.orgId)).leftJoin(projects, eq(projects.id, complaints.projectId)).where(inArray(complaints.status, statuses)).orderBy(desc(complaints.createdAt));
}

/** Steps past their deadline (ops-watch and the Needs-you inbox). */
export async function overdueComplaints(db: Db, now = new Date()) {
  return db.select({ c: complaints, company: organizations.name }).from(complaints).innerJoin(organizations, eq(organizations.id, complaints.orgId)).where(and(eq(complaints.status, "open"), lt(complaints.dueAt, now)));
}
