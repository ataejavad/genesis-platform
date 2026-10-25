import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { leads } from "@/db/schema";
import type { Actor } from "./actor";
import { emit } from "./events";
import { type HubResearch, loadResearch } from "./hubs";

/*
 * Deadline reminders (hub hook promise "remind me 30 days before each deadline"). Daily: every confirmed lead who
 * asked for reminders gets one email per matching deadline once it is 30 days away or less. One event per lead and
 * deadline, so a reminder is never sent twice; the email is queued from the event (notify.ts) with an unsubscribe link.
 */

export const REMIND_DAYS = 30;
const DAY = 864e5;

export async function leadReminders(db: Db, now = new Date(), research: HubResearch[] = loadResearch()) {
  const actor: Actor = { type: "system", id: "deadline-reminders" };
  const today = now.toISOString().slice(0, 10);
  const horizon = new Date(now.getTime() + REMIND_DAYS * DAY).toISOString().slice(0, 10);
  let sent = 0;
  for (const r of research) {
    const soon = r.deadlines.filter((d) => d.date && d.date >= today && d.date <= horizon);
    if (!soon.length) continue;
    const people = await db.select().from(leads).where(and(eq(leads.industry, r.industry), eq(leads.country, r.country), eq(leads.reminders, true), isNotNull(leads.confirmedAt), isNull(leads.unsubscribedAt)));
    for (const l of people) {
      const tags = new Set(l.tags);
      for (const d of soon.filter((x) => x.tags.includes("all") || x.tags.some((t) => tags.has(t)))) {
        const [done] = (await db.execute(sql`select 1 from events where type = 'lead.reminder_due' and subject_id = ${l.id} and payload->>'deadlineId' = ${d.id} limit 1`)) as unknown as unknown[];
        if (done) continue;
        const days = Math.max(0, Math.round((Date.parse(`${d.date}T12:00:00Z`) - now.getTime()) / DAY));
        await db.transaction((tx) => emit(tx, actor, "lead.reminder_due", { type: "lead", id: l.id }, { deadlineId: d.id, date: d.date, days, title: d.title, what: d.what, offer: d.offer, industry: r.industry, country: r.country }));
        sent++;
      }
    }
  }
  return { sent };
}
