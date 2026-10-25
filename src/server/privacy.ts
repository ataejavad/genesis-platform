import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { account, contacts, customerRequests, leads, memberships, notifications, portalMessages, portalThreads, projectInputs, prospects, session, user } from "@/db/schema";
import type { Actor } from "./actor";
import { AppError } from "./errors";
import { audit, emit } from "./events";
import { removeFile } from "./files";

/*
 * Right to erasure (GDPR art. 17) for a customer, within the one-month deadline (art. 12(3)); process gap "data.delete".
 * Erased: the people's logins and names, conversations, project material (text and files), marketing and sales
 * records under their emails, queued messages. Kept: contracts and invoices, which Italian law keeps for 10 years
 * (art. 2220 c.c.; GDPR art. 17(3)(b)) — the company name stays on them.
 */
export async function eraseCustomer(db: Db, actor: Actor, orgId: string, requestId?: string) {
  const out = await db.transaction(async (tx) => {
    const people = await tx.select({ id: user.id, email: user.email, role: user.role }).from(memberships).innerJoin(user, eq(user.id, memberships.userId)).where(eq(memberships.orgId, orgId));
    if (people.some((p) => p.role === "admin")) throw new AppError(400, "team", "this organization has team members; remove them first");
    const emails = people.map((p) => p.email);
    const ids = people.map((p) => p.id);
    if (ids.length) {
      await tx.delete(session).where(inArray(session.userId, ids));
      await tx.delete(account).where(inArray(account.userId, ids));
      for (const p of people) await tx.update(user).set({ name: "Erased", email: `erased-${p.id}@invalid` }).where(eq(user.id, p.id));
    }
    const threads = await tx.select({ id: portalThreads.id }).from(portalThreads).where(eq(portalThreads.orgId, orgId));
    if (threads.length) await tx.delete(portalMessages).where(inArray(portalMessages.threadId, threads.map((t) => t.id)));
    await tx.delete(portalThreads).where(eq(portalThreads.orgId, orgId));
    const keys = (await tx.select({ k: projectInputs.fileKey }).from(projectInputs).where(eq(projectInputs.orgId, orgId))).map((r) => r.k).filter((k): k is string => Boolean(k));
    const files = await tx.update(projectInputs).set({ text: null, cleanText: null, fileKey: null, status: "withheld" }).where(eq(projectInputs.orgId, orgId)).returning({ id: projectInputs.id });
    await tx.update(customerRequests).set({ text: "[erased]" }).where(and(eq(customerRequests.orgId, orgId)));
    if (emails.length) {
      await tx.delete(contacts).where(inArray(contacts.email, emails));
      const leadIds = (await tx.select({ id: leads.id }).from(leads).where(inArray(leads.email, emails))).map((l) => l.id);
      // the company stays in the CRM (business data); the link to the person's lead and a name that is their email go
      if (leadIds.length) await tx.update(prospects).set({ leadId: null }).where(inArray(prospects.leadId, leadIds));
      await tx.update(prospects).set({ name: "Erased", website: null }).where(inArray(prospects.name, emails));
      await tx.delete(leads).where(inArray(leads.email, emails));
      await tx.delete(notifications).where(and(inArray(notifications.email, emails), eq(notifications.status, "queued")));
    }
    if (requestId) await tx.update(customerRequests).set({ status: "done", reply: "Your personal data was erased. Contracts and invoices are kept as the law requires (10 years)." }).where(eq(customerRequests.id, requestId));
    const facts = { people: ids.length, materials: files.length };
    await emit(tx, actor, "data.erased", { type: "organization", id: orgId }, facts);
    await audit(tx, actor, "data.erased", { type: "organization", id: orgId }, null, facts);
    return { ...facts, keys };
  });
  for (const k of out.keys) await removeFile(k);
  return { people: out.people, materials: out.materials };
}
