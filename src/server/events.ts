import type { DbOrTx } from "@/db";
import { auditLog, events } from "@/db/schema";
import { type Actor, actorRef } from "./actor";
import { requestTick } from "./tick-soon";

export type EventType =
  | "approval.requested"
  | "approval.decided"
  | "content.published"
  | "content.rejected"
  | "lead.captured"
  | "checkup.completed"
  | "checkup.unlocked"
  | "checkup.call_requested"
  | "prospect.added"
  | "outbound.run_finished"
  | "prospect.stage_changed"
  | "prospect.opted_out"
  | "outreach.approved"
  | "outreach.switch_changed"
  | "company_page.viewed"
  | "whatsapp.received"
  | "customer.created"
  | "subscription.started"
  | "outcome.recorded"
  | "customer_approval.requested"
  | "customer_approval.decided"
  | "customer_request.created"
  | "partner.applied"
  | "partner.activated"
  | "partner.message"
  | "partner.document_added"
  | "job.offered"
  | "job.assigned"
  | "delivery.submitted"
  | "delivery.reviewed"
  | "payout.paid"
  | "order.created"
  | "project.created"
  | "project.closed"
  | "job.opened"
  | "project_input.added"
  | "project_input.decided"
  | "qa.judged"
  | "milestone.ready"
  | "milestone.accepted"
  | "milestone.changes"
  | "milestone.reminded"
  | "milestone.late"
  | "order.vat_checked"
  | "change_request.quoted"
  | "change_request.decided"
  | "protocol.approved"
  | "ops.flagged"
  | "contract.sent"
  | "contract.signed"
  | "invoice.requested"
  | "invoice.paid"
  | "invoice.issued"
  | "invoice.reminded"
  | "lead.confirmed"
  | "data.erased"
  | "agent.paused"
  | "experiment.ready"
  | "experiment.decided"
  | "customer.at_risk"
  | "results.reported"
  | "lead.reminder_due"
  | "switch.changed"
  | "complaint.opened"
  | "complaint.escalated"
  | "complaint.resolved"
  | "milestone.rated"
  | "milestone.revision_cap"
  | "milestone.started"
  | "milestone.auto_accepted"
  | "job.rework"
  | "service.checked"
  | "service.cost_recorded"
  | "subscription.cancelled"
  | "subscription.kept"
  | "subscription.ended"
  | "subscription.supplier_changed"
  | "loss.recorded"
  | "supply.gap"
  | "supply.invited";

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
  // hosts without an always-on worker process the event right after this request (src/server/tick-soon.ts)
  requestTick();
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
