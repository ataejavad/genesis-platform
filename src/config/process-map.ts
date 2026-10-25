/*
 * Process map: every step of every relationship in the company, in one place.
 * customer → us, us → customer, partner → us, us → partner, partner → partner, agents, founder, money, data.
 *
 * `npm run audit:process` reads this file next to the code and fails when
 *   - an event type is emitted but no step consumes it (a handoff that goes nowhere),
 *   - a handler named here does not exist in the code,
 *   - a step is done by a person or not built yet and nobody watches it (no SLA / watcher).
 * Every build step updates this map before it is done (CLAUDE.md). The report lists the founder's manual
 * steps and every open gap, ranked, so gaps are found by the system, not by Javad.
 */

export type Flow =
  | "acquire" // strangers become leads and prospects
  | "convert" // prospects become paying customers
  | "deliver" // orders become delivered results
  | "retain" // customers stay, grow and refer
  | "partner" // people and agents who work for or through us
  | "money" // invoices, payments, payouts, tax
  | "data" // consent, privacy, retention, security
  | "agents" // agents, approvals, publishing
  | "founder"; // what reaches Javad and how the company steers itself

export type By = "auto" | "human" | "planned";

export type Step = {
  id: string;
  flow: Flow;
  /** who hands to whom, e.g. "customer→us" */
  edge: string;
  /** what starts it: `event:<type>`, `schedule:<when>`, `person:<who>` or `api:<route>` */
  trigger: string;
  does: string;
  by: By;
  /** `path/to/file.ts#function` that does it today */
  handler?: string;
  /** promise to the other side, e.g. "5 min", "1 working day" */
  sla?: string;
  /** what notices when it stalls (ops-watch kind, deliveryWatch, cockpit page) */
  watch?: string;
  /** build step that adds it, for `planned` steps */
  step?: number;
  /** known gap: what breaks or stays manual today, and the impact */
  gap?: string;
  /** 1 = costs customers or money now, 2 = slows growth or adds manual work, 3 = later */
  impact?: 1 | 2 | 3;
};

export const STEPS: Step[] = [
  /* ───────── acquire ───────── */
  { id: "market.select", flow: "acquire", edge: "agents→us", trigger: "schedule:monthly (GitHub Actions)", does: "Market-selection agents rank industry × country filters", by: "auto", handler: "scripts/market-selection.ts", watch: "cockpit wiring #1" },
  { id: "hub.build", flow: "acquire", edge: "agents→us", trigger: "person:npm run agents:hubs", does: "Hub builder drafts hub pages; Javad approves", by: "auto", handler: "scripts/hub-builder.ts", watch: "hub freshness (hubs.ts MAX_AGE)", gap: "Runs only when started by hand; no weekly schedule until n8n/server (step 11)", impact: 3 },
  { id: "lead.capture", flow: "acquire", edge: "visitor→us", trigger: "api:/api/v1/leads", does: "Hub hook stores lead with consent text", by: "auto", handler: "src/server/leads.ts#captureLead" },
  { id: "lead.confirm", flow: "acquire", edge: "us→lead", trigger: "event:lead.captured", does: "Double opt-in email in the lead's language (signed link)", by: "auto", handler: "src/server/notify.ts#notifyEvent", gap: "Welcome series, deadline reminders and newsletter content are not built yet (step 9); nothing is sent until the Brevo key is set", impact: 2 },
  { id: "lead.to_crm", flow: "acquire", edge: "us→us", trigger: "event:lead.confirmed", does: "Confirmed hub lead becomes a CRM prospect (source hub, company from answers)", by: "auto", handler: "src/server/crm.ts#prospectFromLead" },
  { id: "checkup.run", flow: "acquire", edge: "visitor→us", trigger: "api:/api/v1/checkups", does: "Conversation check-up, report, unlock with email", by: "auto", handler: "src/server/checkup.ts#unlockCheckup" },
  { id: "checkup.to_crm", flow: "acquire", edge: "us→us", trigger: "event:checkup.unlocked", does: "Unlocked check-up becomes a prospect with priority", by: "auto", handler: "src/server/crm.ts#prospectFromCheckup" },
  { id: "checkup.call", flow: "convert", edge: "lead→us", trigger: "event:checkup.call_requested", does: "Telegram alert to call back", by: "human", handler: "src/worker/dispatch.ts", sla: "5 min", watch: "telegram", gap: "Only Javad can call; no booking link or AI first call when he is away", impact: 2 },
  { id: "checkup.nurture", flow: "acquire", edge: "us→lead", trigger: "event:checkup.completed", does: "Report by email + follow-up if not unlocked or no call", by: "planned", step: 9, gap: "Completed but not unlocked check-ups are lost: we have no email for them yet (ask for it earlier in the conversation, then follow up)", impact: 2 },
  { id: "outbound.find", flow: "acquire", edge: "agents→us", trigger: "person:npm run agents:outbound", does: "Company finder + scorer add prospects", by: "auto", handler: "src/agents/company-finder.ts", watch: "cockpit wiring #14", gap: "Daily run is manual until the server scheduler (step 11)", impact: 2 },
  { id: "outbound.added", flow: "acquire", edge: "us→us", trigger: "event:prospect.added", does: "Company page + touch plan drafted", by: "auto", handler: "src/server/crm.ts#addProspect" },
  { id: "outbound.approve", flow: "acquire", edge: "us→prospect", trigger: "person:Javad in Cockpit › Outbound", does: "Javad approves the first message per company", by: "human", handler: "src/server/outreach.ts#approveSequence", watch: "cockpit outbound queue", gap: "Every company needs Javad's click: caps outbound at his time; auto-approve low-risk templates after N approvals", impact: 2 },
  { id: "outbound.send", flow: "acquire", edge: "us→prospect", trigger: "schedule:every 10 min (worker)", does: "Email (Brevo) and AI calls (Vapi) that are due", by: "auto", handler: "src/server/outreach.ts#sendDueEmails", gap: "Off until BREVO/VAPI keys", impact: 1 },
  { id: "outbound.approved", flow: "acquire", edge: "us→us", trigger: "event:outreach.approved", does: "Audit only (touches already scheduled)", by: "auto", handler: "src/server/outreach.ts#approveSequence" },
  { id: "outbound.switch", flow: "data", edge: "founder→us", trigger: "event:outreach.switch_changed", does: "Channel switch per country with legal basis", by: "human", handler: "src/server/outreach.ts#setSwitch" },
  { id: "outbound.optout", flow: "data", edge: "prospect→us", trigger: "event:prospect.opted_out", does: "Stop every touch, keep suppression record", by: "auto", handler: "src/server/outreach.ts#optOut" },
  { id: "page.viewed", flow: "convert", edge: "prospect→us", trigger: "event:company_page.viewed", does: "Speed-to-lead alert", by: "human", handler: "src/worker/dispatch.ts", sla: "same day", watch: "telegram" },
  { id: "reply.received", flow: "convert", edge: "prospect→us", trigger: "event:prospect.stage_changed", does: "Reply / interested / meeting alert", by: "human", handler: "src/worker/dispatch.ts", sla: "5 min", watch: "telegram" },
  { id: "whatsapp.in", flow: "convert", edge: "prospect→us", trigger: "event:whatsapp.received", does: "WhatsApp agent answers, alert to Javad", by: "auto", handler: "src/server/whatsapp.ts", sla: "5 min", watch: "telegram", gap: "Off until WHATSAPP keys", impact: 3 },

  /* ───────── convert ───────── */
  { id: "crm.won", flow: "convert", edge: "prospect→us", trigger: "person:Javad clicks Won → order in CRM", does: "Order made from the CRM data (company, email, country, package); prospect moves to won", by: "human", handler: "src/server/crm.ts#wonToOrder", watch: "ops-watch:order" },
  { id: "order.create", flow: "convert", edge: "customer→us", trigger: "api:/api/v1/orders", does: "Marketplace, dashboard and chat orders land in one inbox", by: "auto", handler: "src/server/projects.ts#createOrder" },
  { id: "order.alert", flow: "convert", edge: "us→founder", trigger: "event:order.created", does: "Telegram alert", by: "auto", handler: "src/worker/dispatch.ts", watch: "ops-watch:order" },
  { id: "order.convert", flow: "convert", edge: "us→customer", trigger: "person:Javad clicks Send contract", does: "Customer account (or the returning buyer's) + contract from the package and country pack", by: "human", handler: "src/server/contracts.ts#sendContract", sla: "1 day", watch: "ops-watch:order", gap: "Every order waits for Javad's click; standard packages could send their contract automatically once the template is lawyer-reviewed", impact: 2 },
  { id: "contract.gate", flow: "convert", edge: "customer→us", trigger: "event:contract.sent", does: "Contract email; customer signs in the portal with an email code, onerous clauses with a second code (art. 1341 c.c.)", by: "auto", handler: "src/server/contracts.ts#confirmSignCode", sla: "3 days", watch: "ops-watch:contract", gap: "Template not lawyer-reviewed yet (IT-2026.1 draft)", impact: 2 },
  { id: "contract.signed", flow: "money", edge: "customer→us", trigger: "event:contract.signed", does: "Customer: deposit payment request (IBAN + QR + reference); deposit 0 starts at once. Partner: offers open; independence answers flagged on Telegram", by: "auto", handler: "src/server/contracts.ts#confirmSignCode" },
  { id: "invoice.request", flow: "money", edge: "us→customer", trigger: "event:invoice.requested", does: "Payment request email with IBAN, EPC QR code and reference; shown in Contract & billing", by: "auto", handler: "src/server/notify.ts#notifyEvent", sla: "14 days", watch: "Finance › overdue" },
  { id: "invoice.mark_paid", flow: "money", edge: "customer→us", trigger: "person:Javad marks paid in Finance", does: "Money seen in the bank (match by reference)", by: "human", handler: "src/server/finance.ts#markInvoicePaid", sla: "1 working day", watch: "Finance › open requests", gap: "No bank feed: transfers are matched by hand (PSD2 bank import later)", impact: 2 },
  { id: "invoice.paid", flow: "money", edge: "us→us", trigger: "event:invoice.paid", does: "Paid deposit starts the project; Telegram alert", by: "auto", handler: "src/server/finance.ts#markInvoicePaid" },
  { id: "invoice.issued", flow: "money", edge: "us→customer", trigger: "event:invoice.issued", does: "Legal invoice number (YEAR/NNNN) once registered; receipt email", by: "auto", handler: "src/server/finance.ts#issuePaid", gap: "SdI e-invoice provider not chosen yet (after business registration): invoices are numbered but not transmitted", impact: 2 },
  { id: "invoice.reminded", flow: "money", edge: "us→customer", trigger: "event:invoice.reminded", does: "Reminders 3 days before, +1, +7 (interest), +14 (pause warning); Telegram from +7", by: "auto", handler: "src/server/finance.ts#dunning" },
  { id: "customer.invite", flow: "convert", edge: "us→customer", trigger: "event:customer.created", does: "Invite email with a set-password link (7 days) in the customer's language", by: "auto", handler: "src/server/notify.ts#notifyEvent", gap: "Until the Brevo key is set Javad forwards it from Outbox", impact: 2 },

  /* ───────── deliver ───────── */
  { id: "project.created", flow: "deliver", edge: "us→us", trigger: "event:project.created", does: "Milestones + tasks with fixed protocol versions", by: "auto", handler: "src/server/projects.ts#createProject" },
  { id: "job.offer", flow: "partner", edge: "us→partner", trigger: "event:job.offered", does: "Offer appears in partner portal / agent API", by: "auto", handler: "src/server/partners.ts#offerJob", sla: "48 h answer", watch: "ops-watch:no_match", gap: "Offer email waits for the Brevo key; no WhatsApp yet", impact: 3 },
  { id: "job.reoffer", flow: "partner", edge: "us→partner", trigger: "schedule:hourly (worker)", does: "Expire unanswered offers, re-offer declined jobs, flag jobs with no match", by: "auto", handler: "src/server/ops-watch.ts#opsWatch", watch: "ops-watch:no_match" },
  { id: "job.assigned", flow: "partner", edge: "partner→us", trigger: "event:job.assigned", does: "First partner to accept gets the job", by: "auto", handler: "src/server/partners.ts#respondOffer", watch: "ops-watch:late" },
  { id: "delivery.submit", flow: "partner", edge: "partner→us", trigger: "event:delivery.submitted", does: "QA judge, then auto-accept or human queue", by: "auto", handler: "src/server/projects.ts#afterDelivery", watch: "ops-watch:qa", gap: "Judge off until ANTHROPIC_API_KEY: every delivery waits for Javad", impact: 2 },
  { id: "qa.judged", flow: "deliver", edge: "agents→us", trigger: "event:qa.judged", does: "Judge verdict stored for agreement KPI", by: "auto", handler: "src/server/projects.ts#afterDelivery" },
  { id: "delivery.review", flow: "partner", edge: "us→partner", trigger: "event:delivery.reviewed", does: "Accepted → payout due, cost booked, milestone check; changes → back to partner", by: "auto", handler: "src/server/partners.ts#reviewDelivery" },
  { id: "milestone.ready", flow: "deliver", edge: "us→customer", trigger: "event:milestone.ready", does: "Customer approval card in dashboard", by: "auto", handler: "src/server/projects.ts#onJobAccepted", sla: "customer OK", watch: "deliveryWatch (24h reminder)", gap: "Approval email and 24h reminder to the customer wait for the Brevo key", impact: 2 },
  { id: "customer_approval.ask", flow: "deliver", edge: "us→customer", trigger: "event:customer_approval.requested", does: "Approval shown in dashboard / chat", by: "auto", handler: "src/server/portal.ts#askCustomerApproval", watch: "ops-watch:approval" },
  { id: "customer_approval.decide", flow: "deliver", edge: "customer→us", trigger: "event:customer_approval.decided", does: "Milestone accepted or changes; Telegram alert", by: "auto", handler: "src/server/projects.ts#onApprovalDecided" },
  { id: "milestone.changes", flow: "deliver", edge: "customer→us", trigger: "event:milestone.changes", does: "Alert; Javad reopens tasks", by: "human", handler: "src/worker/dispatch.ts", gap: "Changes do not reopen partner tasks automatically", impact: 2 },
  { id: "milestone.reminded", flow: "deliver", edge: "us→founder", trigger: "event:milestone.reminded", does: "Daily reminder that the customer has not decided", by: "auto", handler: "src/server/projects.ts#deliveryWatch" },
  { id: "milestone.invoice", flow: "money", edge: "us→customer", trigger: "event:milestone.accepted", does: "Payment request for the milestone minus the deposit still unused", by: "auto", handler: "src/server/finance.ts#billMilestone" },
  { id: "change.quote", flow: "deliver", edge: "us→customer", trigger: "event:change_request.quoted", does: "Priced scope change sent for approval", by: "human", handler: "src/server/projects.ts#quoteChange", watch: "ops-watch:approval" },
  { id: "change.decided", flow: "deliver", edge: "customer→us", trigger: "event:change_request.decided", does: "Approved → new milestone + days", by: "auto", handler: "src/server/projects.ts#onApprovalDecided" },
  { id: "project.close", flow: "deliver", edge: "us→us", trigger: "event:project.closed", does: "Margin, lessons → protocol drafts, monthly subscription starts", by: "auto", handler: "src/server/projects.ts#closeProject" },
  { id: "protocol.approve", flow: "deliver", edge: "founder→us", trigger: "event:protocol.approved", does: "New protocol version for new projects", by: "human", handler: "src/server/projects.ts#approveVersion" },

  { id: "input.collect", flow: "deliver", edge: "customer→us", trigger: "person:customer answers in dashboard chat", does: "Customer material (text, files, meeting notes) collected per project need", by: "auto", handler: "src/server/portal-chat.ts#materialTurn", gap: "Customer is not reminded outside the portal when material is missing; tasks wait", impact: 2 },
  { id: "input.added", flow: "deliver", edge: "customer→us", trigger: "event:project_input.added", does: "Text redacted and shared with partners; files wait for a person (status check)", by: "human", handler: "src/server/projects.ts#addInput", sla: "1 day", watch: "ops-watch:input" },
  { id: "input.decided", flow: "data", edge: "us→partner", trigger: "event:project_input.decided", does: "File shared with partners or withheld (audit + n8n)", by: "human", handler: "src/server/projects.ts#decideInput", gap: "Every customer file needs Javad's click until file redaction exists", impact: 3 },
  { id: "job.opened", flow: "partner", edge: "partner→partner", trigger: "event:job.opened", does: "Assembly or QA-partner job offered to partners with the skill", by: "auto", handler: "src/worker/dispatch.ts", watch: "ops-watch:no_match" },
  /* ───────── retain ───────── */
  { id: "customer.created", flow: "retain", edge: "us→customer", trigger: "event:customer.created", does: "Account + org", by: "auto", handler: "src/server/portal.ts#createCustomer" },
  { id: "subscription.start", flow: "money", edge: "us→customer", trigger: "event:subscription.started", does: "Monthly payment request from the start month (worker bills each month, once per subscription and month)", by: "auto", handler: "src/server/finance.ts#billSubscriptions", gap: "Bank transfer each month; a SEPA direct-debit mandate (fewer late payments) is not offered yet", impact: 2 },
  { id: "outcome.record", flow: "retain", edge: "agents→customer", trigger: "event:outcome.recorded", does: "Results ledger: € back vs fee", by: "human", handler: "src/server/portal.ts#addOutcome", gap: "Results are typed by hand; no delivering agent records them yet", impact: 2 },
  { id: "report.monthly", flow: "retain", edge: "us→customer", trigger: "schedule:monthly", does: "Results report (ROI vs fee) to each customer", by: "planned", step: 9, gap: "Customers never get a proactive results report: churn risk", impact: 2 },
  { id: "churn.watch", flow: "retain", edge: "us→us", trigger: "schedule:weekly", does: "ROI < 1, no logins, open requests → save plan", by: "planned", step: 9, gap: "ROI < 1 is shown, nobody acts on it", impact: 2 },
  { id: "request.in", flow: "retain", edge: "customer→us", trigger: "event:customer_request.created", does: "Telegram alert; answer in cockpit", by: "human", handler: "src/server/portal.ts#createRequest", sla: "1 working day", watch: "ops-watch:request" },
  { id: "case.study", flow: "retain", edge: "customer→us", trigger: "event:project.closed", does: "Ask permission, draft case study + referral ask", by: "planned", step: 9, gap: "First wins are not turned into case studies or referrals", impact: 2 },

  /* ───────── partner ───────── */
  { id: "partner.apply", flow: "partner", edge: "partner→us", trigger: "event:partner.applied", does: "Rules screen, Telegram alert", by: "auto", handler: "src/server/partners.ts#applyPartner", watch: "ops-watch:application" },
  { id: "partner.decide", flow: "partner", edge: "us→partner", trigger: "person:Javad in Cockpit › Partners", does: "Accept/reject", by: "human", handler: "src/server/partners.ts#decideApplication", sla: "3 days", watch: "ops-watch:application" },
  { id: "partner.activated", flow: "partner", edge: "us→partner", trigger: "event:partner.activated", does: "Framework agreement (NDA, sub-processor, white-label, non-circumvention) sent with the invite; no offers until signed", by: "auto", handler: "src/server/contracts.ts#createPartnerContract", watch: "ops-watch:contract" },
  { id: "partner.message", flow: "partner", edge: "partner→us", trigger: "event:partner.message", does: "Masked message, alert", by: "auto", handler: "src/server/partners.ts#sendPartnerMessage" },
  { id: "partner.document", flow: "partner", edge: "partner→us", trigger: "event:partner.document_added", does: "We check the document", by: "human", handler: "src/server/partners.ts#addDocument", watch: "ops-watch:document", gap: "No alert when a document is added; checks wait until Javad opens the page", impact: 3 },
  { id: "payout.due", flow: "money", edge: "us→partner", trigger: "schedule:hourly (ops-watch)", does: "Due payouts as one SEPA file; Javad uploads it to the bank and marks the batch paid", by: "human", handler: "src/server/finance.ts#payoutBatch", sla: "level days", watch: "ops-watch:payout", gap: "No self-billing invoice or partner VAT handling yet; bank upload is manual (bank API later)", impact: 2 },
  { id: "payout.paid", flow: "money", edge: "us→partner", trigger: "event:payout.paid", does: "Partner sees it in earnings", by: "auto", handler: "src/server/partners.ts#markPaid" },

  /* ───────── agents + content ───────── */
  { id: "draft.approval", flow: "agents", edge: "agents→founder", trigger: "event:approval.requested", does: "Telegram approve/reject buttons", by: "human", handler: "src/server/telegram.ts#sendApprovalRequest" },
  { id: "draft.decided", flow: "agents", edge: "founder→agents", trigger: "event:approval.decided", does: "Publish or reject", by: "auto", handler: "src/server/content.ts" },
  { id: "content.published", flow: "agents", edge: "us→public", trigger: "event:content.published", does: "Page live, sitemap, llms.txt", by: "auto", handler: "src/server/content.ts" },
  { id: "content.rejected", flow: "agents", edge: "founder→agents", trigger: "event:content.rejected", does: "Agent learns from the rejection note", by: "planned", step: 9, gap: "Rejection reasons are not fed back to the agent that wrote the draft", impact: 3 },
  { id: "agent.costs", flow: "agents", edge: "agents→founder", trigger: "schedule:per run", does: "Cost per run in agent_runs, budget caps", by: "auto", handler: "src/db/schema.ts", watch: "cockpit wiring (step 10)" },

  /* ───────── data ───────── */
  { id: "data.export", flow: "data", edge: "customer→us", trigger: "person:customer in dashboard", does: "Full data export", by: "auto", handler: "src/server/portal.ts#exportData" },
  { id: "data.delete", flow: "data", edge: "customer→us", trigger: "person:customer request kind data_delete", does: "Javad confirms; people, chats, material and files erased, contracts and invoices kept 10 years", by: "human", handler: "src/server/privacy.ts#eraseCustomer", sla: "30 days", watch: "ops-watch:request", gap: "Copies inside partners' delivered work are not erased automatically", impact: 3 },
  { id: "data.retention", flow: "data", edge: "us→us", trigger: "schedule:monthly", does: "Purge cold prospects without reply after 12 months, old transcripts, unconfirmed leads", by: "planned", step: 9, gap: "No retention limits: prospect and transcript data kept forever (GDPR storage limitation)", impact: 2 },
  { id: "backup", flow: "data", edge: "us→us", trigger: "schedule:daily", does: "Encrypted backup + monthly restore test", by: "planned", step: 11 },

  /* ───────── founder / steering ───────── */
  { id: "ops.watch", flow: "founder", edge: "us→founder", trigger: "event:ops.flagged", does: "Hourly digest of stuck work (no partner, late, money due, waiting people, dead events)", by: "auto", handler: "src/server/ops-watch.ts#opsWatch" },
  { id: "process.audit", flow: "founder", edge: "us→founder", trigger: "schedule:every build step + CI + monthly", does: "This map vs the code: unconsumed events, manual steps, open gaps", by: "auto", handler: "scripts/process-audit.ts" },
  { id: "daily.report", flow: "founder", edge: "us→founder", trigger: "schedule:daily", does: "Orchestrator: one short report, decisions needed, KPIs", by: "planned", step: 9 },
  { id: "notify.layer", flow: "founder", edge: "us→everyone", trigger: "event:*", does: "One notification module: event → recipient → template in their language → queue → mailer", by: "auto", handler: "src/server/notify.ts#notifyEvent", watch: "Cockpit › Outbox", gap: "Email only, and nothing leaves until the Brevo key is set; WhatsApp/SMS later", impact: 1 },
];

/** Events that are deliberately consumed by nobody but the audit log and n8n. Each needs a reason. */
export const LOG_ONLY: Record<string, string> = {
  "data.erased": "Proof that an erasure happened (audit trail and n8n); nothing else may react to it",
};
