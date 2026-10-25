import { and, asc, eq, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { events } from "@/db/schema";
import { prospectFromLead } from "@/server/crm";
import { billNext } from "@/server/finance";
import { askForStory } from "@/server/health";
import { notifyEvent } from "@/server/notify";
import { offerJob } from "@/server/partners";
import { afterDelivery } from "@/server/projects";
import { sendAlert, sendApprovalRequest, type TelegramConfig } from "@/server/telegram";

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
  // Speed to lead: a person asked for a call or answered us; the target is a reply within 5 minutes.
  if (deps.telegram && event.type === "company_page.viewed") {
    const p = event.payload as { company?: string; industry?: string };
    await sendAlert(deps.telegram, [`👀 ${p.company} (${p.industry}) صفحه‌اش را باز کرد`], `/cockpit/crm/${event.subjectId}`, fetchImpl);
  }
  if (deps.telegram && event.type === "whatsapp.received") {
    const p = event.payload as { from?: string; text?: string };
    await sendAlert(deps.telegram, [`💬 WhatsApp ${p.from}: ${String(p.text ?? "").slice(0, 200)}`], "/cockpit/outreach", fetchImpl);
  }
  if (deps.telegram && (event.type === "checkup.call_requested" || (event.type === "prospect.stage_changed" && ["replied", "interested", "meeting"].includes(String(event.payload.to))))) {
    const p = event.payload as { industry?: string; totalEur?: number; to?: string; why?: string };
    const head = event.type === "checkup.call_requested" ? `📞 درخواست تماس (${p.industry}, €${p.totalEur ?? "?"}): تا ۵ دقیقه زنگ بزن` : `💬 ${p.industry}: ${p.to} (${p.why ?? ""})`;
    await sendAlert(deps.telegram, [head], "/cockpit/outreach", fetchImpl);
  }
  // Customer dashboard: a customer asked for something or answered an approval (target: reply within a working day).
  if (deps.telegram && (event.type === "customer_request.created" || event.type === "customer_approval.decided")) {
    const p = event.payload as { company?: string; kind?: string; text?: string; title?: string; decision?: string; note?: string | null };
    const line = event.type === "customer_request.created" ? `📨 ${p.company} (${p.kind}): ${String(p.text ?? "").slice(0, 200)}` : `${p.decision === "approved" ? "✅" : "✏️"} ${p.company}: ${p.title}${p.note ? ` (${p.note})` : ""}`;
    await sendAlert(deps.telegram, [line], "/cockpit/customers", fetchImpl);
  }
  // Partner portal: new applications, work to review, and messages (review requests and hidden contacts first).
  if (deps.telegram && ["partner.applied", "delivery.submitted", "partner.message"].includes(event.type)) {
    const p = event.payload as { name?: string; kind?: string; country?: string; score?: number; title?: string; partner?: string; version?: number; text?: string; flagged?: boolean; reviewRequest?: boolean };
    const line =
      event.type === "partner.applied"
        ? `🤝 New partner application: ${p.name} (${p.kind}, ${p.country}), score ${p.score}`
        : event.type === "delivery.submitted"
          ? `📦 ${p.partner} delivered "${p.title}" (v${p.version}): review it`
          : `${p.reviewRequest ? "⚖️ Human review requested" : p.flagged ? "🚩 Contact details hidden" : "💬"} ${p.partner}: ${String(p.text ?? "").slice(0, 200)}`;
    await sendAlert(deps.telegram, [line], "/cockpit/partners", fetchImpl);
  }
  // Step 7: the QA judge looks at every delivery; low-risk work from trusted partners can pass on its own.
  if (event.type === "delivery.submitted") await afterDelivery(db, event.subjectId!);
  // Orders, customer feedback on milestones and waiting approvals reach Javad at once.
  if (deps.telegram && ["order.created", "milestone.changes", "milestone.reminded", "change_request.decided"].includes(event.type)) {
    const p = event.payload as { package?: string; source?: string; company?: string | null; setupEur?: number; monthlyEur?: number; code?: string; title?: string; note?: string | null; waitingHours?: number; decision?: string };
    const line =
      event.type === "order.created"
        ? `🛒 New order: ${p.package} (${p.source}) ${p.company ?? ""} · €${p.setupEur} + €${p.monthlyEur}/month`
        : event.type === "milestone.changes"
          ? `✏️ ${p.code} ${p.title}: the customer asked for changes${p.note ? ` (${p.note})` : ""}`
          : event.type === "milestone.reminded"
            ? `⏳ ${p.code} ${p.title} (${p.company}) waits for the customer's OK for ${p.waitingHours}h`
            : `📝 Change request ${p.decision}`;
    await sendAlert(deps.telegram, [line], "/cockpit/projects", fetchImpl);
  }
  // Customer journey: complaints, low ratings and the price cap on changes reach Javad at once.
  if (deps.telegram && ["complaint.opened", "complaint.escalated", "milestone.rated", "milestone.revision_cap", "milestone.auto_accepted"].includes(event.type) && !(event.type === "milestone.rated" && Number(event.payload.rating) > 2)) {
    const p = event.payload as { company?: string; code?: string; title?: string; text?: string; step?: string; rating?: number; note?: string | null; cap?: number };
    const line =
      event.type === "complaint.opened"
        ? `😠 ${p.company} not satisfied with ${p.code} ${p.title}: "${p.text}". Free fix started (3 days)`
        : event.type === "complaint.escalated"
          ? p.step === "founder" ? `🆘 ${p.company}: complaint is now YOURS (call within 1 working day): "${p.text}"` : `🔁 ${p.company}: fix did not help, another partner redoes it: "${p.text}"`
          : event.type === "milestone.rated"
            ? `⭐ ${p.rating}/5 from the customer on ${p.code} ${p.title}${p.note ? `: "${p.note}"` : ""}`
            : event.type === "milestone.revision_cap"
              ? `💶 ${p.code} ${p.title}: ${p.cap} free rounds used; quote the extra change within 24h`
              : `⌛ ${p.code} ${p.title} (${p.company}) accepted after 7 silent days`;
    await sendAlert(deps.telegram, [line], event.type.startsWith("complaint") ? "/cockpit/customers" : "/cockpit/projects", fetchImpl);
  }
  // Assembly and QA-partner work is offered to the partners who do it, like any task.
  if (event.type === "job.opened") await offerJob(db, { type: "system", id: "assignment" }, event.subjectId!).catch((e) => console.error("offer failed", e));
  // A customer file waits for a person before any partner sees it.
  if (deps.telegram && event.type === "project_input.added" && event.payload.status === "check") {
    const p = event.payload as { code?: string; label?: string; file?: string };
    await sendAlert(deps.telegram, [`📎 ${p.code}: the customer sent "${p.file}" (${p.label}). Check it before partners see it`], `/cockpit/projects`, fetchImpl);
  }
  // Ops watchdog digest: work that stopped moving (no partner, late, money due, people waiting on us).
  if (deps.telegram && event.type === "ops.flagged") {
    const items = (event.payload.items as { text: string }[] | undefined) ?? [];
    await sendAlert(deps.telegram, [`🚨 ${items.length} stuck item(s)`, ...items.slice(0, 15).map((i) => `• ${i.text}`), items.length > 15 ? `… +${items.length - 15}` : ""].filter(Boolean), "/cockpit", fetchImpl);
  }
  // Step 8: everyone outside hears about what concerns them, in their language (queued; sent when a mailer is set).
  await notifyEvent(db, event);
  // Accepted milestone or approved change → the next milestone is billed before it starts; confirmed hub lead → CRM.
  if (event.type === "milestone.accepted" || (event.type === "change_request.decided" && event.payload.decision === "approved")) await billNext(db, String(event.payload.projectId));
  if (event.type === "lead.confirmed") await db.transaction((tx) => prospectFromLead(tx, { type: "system", id: "double-opt-in" }, event.subjectId!));
  if (deps.telegram && (event.type === "contract.signed" || event.type === "invoice.paid" || (event.type === "invoice.reminded" && Number(event.payload.level) >= 3))) {
    const p = event.payload as { kind?: string; totalEur?: number; title?: string; level?: number; daysLate?: number; independenceFlags?: string[] };
    const line =
      event.type === "contract.signed"
        ? `✍️ ${p.kind === "partner" ? "Partner" : "Customer"} contract signed${p.independenceFlags?.length ? ` · ⚠️ dependent-work signs: ${p.independenceFlags.join(", ")}` : ""}`
        : event.type === "invoice.paid"
          ? `💶 Paid: €${p.totalEur} (${p.kind})`
          : `⏰ ${p.title}: €${p.totalEur} is ${p.daysLate} days late${p.level === 4 ? " (pause warning sent)" : ""}`;
    await sendAlert(deps.telegram, [line], event.type === "contract.signed" ? "/cockpit/contracts" : "/cockpit/finance", fetchImpl);
  }
  // Step 9: agents over budget, finished experiments and customers at risk reach Javad at once (and the brief).
  if (deps.telegram && ["agent.paused", "experiment.ready", "customer.at_risk"].includes(event.type)) {
    const p = event.payload as { name?: string; spentEur?: number; budgetEur?: number; until?: string; key?: string; recommended?: string; why?: string; company?: string; score?: number; reasons?: string[] };
    const [line, link] =
      event.type === "agent.paused"
        ? [`⏸️ ${p.name} paused until ${p.until}: €${p.spentEur} of €${p.budgetEur} budget spent`, "/cockpit/agents"]
        : event.type === "experiment.ready"
          ? [`🧪 Test "${p.key}" finished: ${p.why}. Recommended: ${p.recommended}`, "/cockpit/experiments"]
          : [`🚩 ${p.company} at risk (${p.score}/100): ${(p.reasons ?? []).join("; ")}`, "/cockpit/customers"];
    await sendAlert(deps.telegram, [line], link, fetchImpl);
  }
  // Emergency stop and its release reach Javad's phone (he may have pressed it from someone else's laptop).
  if (deps.telegram && event.type === "switch.changed" && event.payload.id === "stop:all") {
    await sendAlert(deps.telegram, [event.payload.enabled ? "⛔ Emergency stop ON: agents and outbound messages are held" : "▶️ Emergency stop lifted: agents and outbound messages run again"], "/cockpit/systems", fetchImpl);
  }
  // A finished project: ask the customer for a success story and a referral (customer success).
  if (event.type === "project.closed") await askForStory(db, event.subjectId!);
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

/**
 * Local mode (`npm run local`, one embedded database): the same handlers, one event at a time and without the
 * long batch transaction, so the single local database session is never held while a handler writes.
 */
export async function dispatchSimple(db: Db, deps: DispatchDeps, limit = 25): Promise<number> {
  const batch = await db.select().from(events).where(and(isNull(events.dispatchedAt), lt(events.attempts, MAX_ATTEMPTS))).orderBy(asc(events.id)).limit(limit);
  for (const event of batch) {
    try {
      await handle(db, deps, event);
      await db.update(events).set({ dispatchedAt: new Date(), attempts: event.attempts + 1, lastError: null }).where(eq(events.id, event.id));
    } catch (err) {
      await db.update(events).set({ attempts: event.attempts + 1, lastError: err instanceof Error ? err.message : String(err) }).where(eq(events.id, event.id));
    }
  }
  return batch.length;
}
