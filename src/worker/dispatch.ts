import { sql } from "drizzle-orm";
import type { Db } from "@/db";
import { events } from "@/db/schema";
import { sendApprovalRequest, type TelegramConfig } from "@/server/telegram";

export const MAX_ATTEMPTS = 10;

type Event = typeof events.$inferSelect;

export type DispatchDeps = {
  telegram: TelegramConfig | null;
  n8nWebhookUrl?: string;
  fetchImpl?: typeof fetch;
};

async function handle(db: Db, deps: DispatchDeps, event: Event) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  if (event.type === "approval.requested" && deps.telegram) {
    const p = event.payload as { title?: string; summary?: string };
    await sendApprovalRequest(
      db,
      deps.telegram,
      { id: event.subjectId!, title: p.title ?? "", summary: p.summary, requestedBy: event.actor },
      fetchImpl,
    );
  }
  // Every event also goes to n8n, where Genesis workflows subscribe to what they need.
  if (deps.n8nWebhookUrl) {
    const res = await fetchImpl(deps.n8nWebhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: event.id,
        type: event.type,
        subject: { type: event.subjectType, id: event.subjectId },
        payload: event.payload,
        actor: event.actor,
        createdAt: event.createdAt,
      }),
    });
    if (!res.ok) throw new Error(`n8n webhook ${res.status}`);
  }
}

/** Dispatches one batch of outbox events. Safe to run in several workers at once. Returns how many it handled. */
export async function dispatchBatch(db: Db, deps: DispatchDeps, limit = 25): Promise<number> {
  return db.transaction(async (tx) => {
    const batch = (await tx.execute(sql`
      select * from ${events}
      where dispatched_at is null and attempts < ${MAX_ATTEMPTS}
        -- failed events back off exponentially (2, 4, 8 … seconds after creation)
        and (attempts = 0 or created_at + make_interval(secs => power(2, attempts)::int) < now())
      order by id
      limit ${limit}
      for update skip locked
    `)) as unknown as Record<string, any>[];

    for (const row of batch) {
      const event: Event = {
        id: Number(row.id),
        type: row.type,
        subjectType: row.subject_type,
        subjectId: row.subject_id,
        payload: row.payload,
        actor: row.actor,
        createdAt: row.created_at,
        dispatchedAt: null,
        attempts: row.attempts,
        lastError: row.last_error,
      };
      try {
        await handle(db, deps, event);
        await tx.execute(sql`update ${events} set dispatched_at = now(), attempts = attempts + 1, last_error = null where id = ${event.id}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await tx.execute(sql`update ${events} set attempts = attempts + 1, last_error = ${message} where id = ${event.id}`);
      }
    }
    return batch.length;
  });
}
