import { eq, like } from "drizzle-orm";
import type { Db, DbOrTx } from "@/db";
import { switches } from "@/db/schema";
import type { Actor } from "./actor";
import { audit, emit } from "./events";

/*
 * Javad's switches (step 10): orchestrator jobs, market filters and the emergency stop. The stop pauses every agent
 * and everything that reaches people outside (outreach, reminders, queued emails); watchdogs and billing keep
 * running so nothing is lost. Each change is audited; the stop also goes to Telegram.
 */

export const STOP = "stop:all";

export async function getSwitch(db: DbOrTx, id: string) {
  const [s] = await db.select().from(switches).where(eq(switches.id, id));
  return s ?? null;
}

export const isStopped = async (db: DbOrTx) => (await getSwitch(db, STOP))?.enabled === true;

export async function switchesLike(db: DbOrTx, prefix: string) {
  return new Map((await db.select().from(switches).where(like(switches.id, `${prefix}%`))).map((s) => [s.id, s]));
}

export async function setSwitch(db: Db, actor: Actor, id: string, enabled: boolean, note?: string) {
  const by = `${actor.type}:${actor.id}`;
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(switches).where(eq(switches.id, id));
    await tx.insert(switches).values({ id, enabled, note: note ?? null, updatedBy: by }).onConflictDoUpdate({ target: switches.id, set: { enabled, note: note ?? null, updatedBy: by, updatedAt: new Date() } });
    await emit(tx, actor, "switch.changed", { type: "switch", id }, { id, enabled, note: note ?? null });
    await audit(tx, actor, "switch.changed", { type: "switch", id }, before ? { enabled: before.enabled } : null, { enabled, note });
  });
}
