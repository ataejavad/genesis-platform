import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import type { Db } from "@/db";
import { contacts, inbox, jobRuns, leads, notifications, prospects, touches } from "@/db/schema";
import type { Actor } from "./actor";
import { audit } from "./events";

/*
 * Data retention (GDPR art. 5(1)(e), step 9): what we no longer need is deleted on the 1st of each month.
 * Periods live here and in the privacy notice. Contracts and invoices are kept 10 years by law (not touched).
 */

const DAY = 864e5;
export const RETENTION = {
  unconfirmedLeadDays: 30, // double opt-in never clicked: no consent, nothing to keep
  coldProspectDays: 365, // contacted, never answered: the people go, the company stays as business data
  inboxDays: 365, // WhatsApp/phone transcripts of prospects
  sentNotificationDays: 365,
  jobRunDays: 30,
};

export async function retention(db: Db, now = new Date()) {
  const before = (days: number) => new Date(now.getTime() - days * DAY);
  const actor: Actor = { type: "system", id: "retention" };
  return db.transaction(async (tx) => {
    const stale = (await tx.select({ id: leads.id }).from(leads).where(and(isNull(leads.confirmedAt), lt(leads.createdAt, before(RETENTION.unconfirmedLeadDays))))).map((l) => l.id);
    if (stale.length) {
      await tx.update(prospects).set({ leadId: null }).where(inArray(prospects.leadId, stale));
      await tx.delete(leads).where(inArray(leads.id, stale));
    }
    // cold companies: never replied a year after we added them; their people and our messages go
    const cold = (await tx.select({ id: prospects.id }).from(prospects).where(and(inArray(prospects.stage, ["new", "contacted", "lost"]), isNull(prospects.repliedAt), lt(prospects.createdAt, before(RETENTION.coldProspectDays))))).map((p) => p.id);
    let people = 0;
    if (cold.length) {
      await tx.delete(touches).where(inArray(touches.prospectId, cold));
      people = (await tx.delete(contacts).where(inArray(contacts.prospectId, cold)).returning({ id: contacts.id })).length;
      await tx.update(prospects).set({ stage: "lost" }).where(and(inArray(prospects.id, cold), inArray(prospects.stage, ["new", "contacted"])));
    }
    const chats = (await tx.delete(inbox).where(lt(inbox.createdAt, before(RETENTION.inboxDays))).returning({ id: inbox.id })).length;
    const mails = (await tx.delete(notifications).where(and(eq(notifications.status, "sent"), lt(notifications.createdAt, before(RETENTION.sentNotificationDays)))).returning({ id: notifications.id })).length;
    const runs = (await tx.delete(jobRuns).where(lt(jobRuns.startedAt, before(RETENTION.jobRunDays))).returning({ id: jobRuns.id })).length;
    const facts = { leads: stale.length, coldCompanies: cold.length, people, chats, mails, jobRuns: runs };
    await audit(tx, actor, "data.retention", { type: "system", id: now.toISOString().slice(0, 10) }, null, facts);
    return facts;
  });
}
