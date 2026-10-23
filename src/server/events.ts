import type { DbOrTx } from "@/db";
import { auditLog, events } from "@/db/schema";
import { type Actor, actorRef } from "./actor";

export type EventType =
  | "approval.requested"
  | "approval.decided"
  | "content.published"
  | "content.rejected"
  | "lead.captured";

// Call inside the same transaction as the change it describes (transactional outbox).
export async function emit(
  tx: DbOrTx,
  actor: Actor,
  type: EventType,
  subject: { type: string; id: string },
  payload: Record<string, unknown> = {},
) {
  await tx.insert(events).values({
    type,
    subjectType: subject.type,
    subjectId: subject.id,
    payload,
    actor: actorRef(actor),
  });
}

export async function audit(
  tx: DbOrTx,
  actor: Actor,
  action: string,
  subject: { type: string; id: string },
  before: unknown,
  after: unknown,
) {
  await tx.insert(auditLog).values({
    actor: actorRef(actor),
    action,
    subjectType: subject.type,
    subjectId: subject.id,
    before: before ?? null,
    after: after ?? null,
  });
}
