/*
 * Module registry (step 10): every part of the machine built in steps 1–9, one row each in Cockpit › Systems.
 * `n` is the row in docs/cockpit-wiring.md. A module is controlled through its agent (registry in agents.ts),
 * its orchestrator job, or the page in `link`; `needs` are the .env keys without which it waits (never their values).
 * Add a row whenever you build something that runs on its own or produces numbers (CLAUDE.md gap check).
 */

export type SystemId = "acquire" | "convert" | "retain" | "deliver" | "partner" | "money" | "data" | "machine";

export const SYSTEMS: { id: SystemId; name: string }[] = [
  { id: "acquire", name: "Find customers" },
  { id: "convert", name: "Win customers" },
  { id: "retain", name: "Keep customers" },
  { id: "deliver", name: "Deliver" },
  { id: "partner", name: "Partners" },
  { id: "money", name: "Money & contracts" },
  { id: "data", name: "Data & privacy" },
  { id: "machine", name: "Machine" },
];

export type ModuleDef = {
  n: number;
  name: string;
  system: SystemId;
  /** where it runs */
  runs: string;
  agent?: string;
  job?: string;
  /** a script started by hand or by GitHub Actions (not the orchestrator) */
  script?: string;
  needs?: string[];
  /** events that mark activity (last one = "last activity") */
  events?: string[];
  /** KPI id in src/server/systems.ts */
  kpi?: string;
  link: string;
};

const CLAUDE = ["ANTHROPIC_API_KEY"];
const MAIL = ["BREVO_API_KEY", "MAIL_FROM"];

export const MODULES: ModuleDef[] = [
  // acquire
  { n: 1, name: "Market-selection agents", system: "acquire", runs: "GitHub Actions, monthly", script: "market-selection", kpi: "filters", link: "/cockpit/markets" },
  { n: 2, name: "Hub builder", system: "acquire", runs: "every local start; weekly on the server", script: "hub-builder", events: ["content.published"], kpi: "hubPages", link: "/cockpit/markets" },
  { n: 3, name: "Hub research (Claude + web)", system: "acquire", runs: "hub builder --research", agent: "hub-research", needs: CLAUDE, link: "/cockpit/agents" },
  { n: 4, name: "Hub KPI: leads per hub", system: "acquire", runs: "on every view", kpi: "leadsMonth", link: "/cockpit/markets" },
  { n: 5, name: "Leads + consent", system: "acquire", runs: "hub hooks", events: ["lead.captured"], kpi: "leadsMonth", link: "/cockpit/leads" },
  { n: 6, name: "Deadline reminders", system: "acquire", runs: "daily 07:00", job: "lead.reminders", needs: MAIL, events: ["lead.reminder_due"], kpi: "reminders", link: "/cockpit/leads" },
  { n: 7, name: "Hub freshness", system: "acquire", runs: "rules on every view", kpi: "hubIssues", link: "/cockpit/markets" },
  { n: 10, name: "Free check-up engine", system: "acquire", runs: "public /checkup + home chat", events: ["checkup.completed", "checkup.unlocked"], kpi: "checkups", link: "/cockpit/markets" },
  { n: 11, name: "Check-up questions + savings rules", system: "acquire", runs: "Git (data/checkup)", kpi: "unlockRate", link: "/cockpit/experiments" },
  { n: 12, name: "Check-up advisor (Claude)", system: "acquire", runs: "at unlock", agent: "checkup-advisor", needs: CLAUDE, link: "/cockpit/agents" },
  { n: 13, name: "Check-up conversation (Claude)", system: "acquire", runs: "every check-up turn", agent: "checkup-chat", needs: CLAUDE, link: "/cockpit/agents" },
  { n: 14, name: "Company finder + scorer", system: "acquire", runs: "npm run agents:outbound (daily on the server)", script: "outbound", needs: ["APIFY_TOKEN"], events: ["prospect.added"], kpi: "prospects", link: "/cockpit/crm" },
  { n: 15, name: "Decision-maker finder (Apollo)", system: "acquire", runs: "with the company finder", needs: ["APOLLO_API_KEY"], kpi: "contacts", link: "/cockpit/crm" },
  { n: 16, name: "Company research + page + persona", system: "acquire", runs: "per new company", agent: "company-research", events: ["company_page.viewed"], kpi: "pageViews", link: "/cockpit/crm" },
  { n: 17, name: "Outreach sequences + approval", system: "acquire", runs: "Javad approves the first message", kpi: "drafts", link: "/cockpit/outreach" },
  { n: 18, name: "Channel switches + legal basis", system: "acquire", runs: "Javad per country", events: ["outreach.switch_changed"], kpi: "blockedTouches", link: "/cockpit/outreach" },
  { n: 19, name: "Outbox: email + AI calls", system: "acquire", runs: "every 10 min", job: "outreach.send", needs: MAIL, kpi: "touchesSent", link: "/cockpit/outreach" },
  { n: 20, name: "WhatsApp agent", system: "acquire", runs: "Meta webhook", agent: "whatsapp-agent", needs: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID"], events: ["whatsapp.received"], link: "/cockpit/agents" },
  { n: 21, name: "Speed-to-lead alerts", system: "convert", runs: "on every inbound event", needs: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_ADMIN_CHAT_ID"], events: ["checkup.call_requested", "company_page.viewed", "prospect.stage_changed"], kpi: "inbound", link: "/cockpit/crm" },
  { n: 22, name: "CRM funnel + channel KPI", system: "convert", runs: "on every CRM view", events: ["prospect.stage_changed"], kpi: "replies", link: "/cockpit/crm" },
  { n: 58, name: "Lead double opt-in → CRM", system: "acquire", runs: "on the confirmation link", events: ["lead.confirmed"], kpi: "confirmRate", link: "/cockpit/leads" },
  { n: 61, name: "Opening-line experiment", system: "acquire", runs: "on every researched company", kpi: "experiments", link: "/cockpit/experiments" },

  // convert
  { n: 37, name: "Orders inbox", system: "convert", runs: "marketplace, dashboard, CRM won", events: ["order.created"], kpi: "orders", link: "/cockpit/projects" },
  { n: 59, name: "CRM won → order", system: "convert", runs: "Javad on the prospect page", events: ["order.created"], kpi: "orders", link: "/cockpit/crm" },
  { n: 72, name: "Brief card + 24h price promise", system: "convert", runs: "customer describes a problem in the chat", events: ["order.created", "customer_request.created"], kpi: "quotes", link: "/cockpit/customers" },
  { n: 52, name: "Contract factory", system: "convert", runs: "Send contract / partner activation", events: ["contract.sent", "contract.signed"], kpi: "contracts", link: "/cockpit/contracts" },

  // retain
  { n: 24, name: "Customer dashboard chat", system: "retain", runs: "every customer message", agent: "portal-advisor", kpi: "portalChats", link: "/cockpit/customers" },
  { n: 25, name: "Results ledger", system: "retain", runs: "agents + Cockpit › Customers", events: ["outcome.recorded"], kpi: "results", link: "/cockpit/customers" },
  { n: 26, name: "Customer approvals", system: "retain", runs: "agents and team ask", events: ["customer_approval.requested", "customer_approval.decided"], kpi: "customerWaiting", link: "/cockpit/customers" },
  { n: 27, name: "Customer requests", system: "retain", runs: "chat + request cards", events: ["customer_request.created"], kpi: "openRequests", link: "/cockpit/customers" },
  { n: 28, name: "Customer accounts + services", system: "retain", runs: "from signed contracts", events: ["customer.created", "subscription.started"], kpi: "mrr", link: "/cockpit/customers" },
  { n: 75, name: "Complaint path (fix → new partner → founder)", system: "retain", runs: "'not satisfied' in the chat", events: ["complaint.opened", "complaint.escalated", "complaint.resolved"], kpi: "complaints", link: "/cockpit/customers#complaints" },
  { n: 76, name: "Ratings after each hand-over", system: "retain", runs: "customer accepts a milestone", events: ["milestone.rated"], kpi: "ratings", link: "/cockpit/projects" },
  { n: 62, name: "Customer health (weekly)", system: "retain", runs: "Monday 07:00", job: "customer.health", events: ["customer.at_risk"], kpi: "atRisk", link: "/cockpit/customers" },
  { n: 63, name: "Monthly results email", system: "retain", runs: "day 1 09:00", job: "results.monthly", needs: MAIL, events: ["results.reported"], link: "/cockpit/customers" },
  { n: 64, name: "Success story + referral ask", system: "retain", runs: "when a project closes", events: ["project.closed"], kpi: "stories", link: "/cockpit/customers" },

  // deliver
  { n: 73, name: "Deemed acceptance (reminders day 1/3/6, accepted day 7)", system: "deliver", runs: "hourly with delivery.watch", job: "delivery.watch", events: ["milestone.reminded", "milestone.auto_accepted"], kpi: "autoAccepted", link: "/cockpit/projects" },
  { n: 74, name: "Free change rounds + rework to the maker", system: "deliver", runs: "customer asks for changes", events: ["milestone.changes", "milestone.revision_cap", "job.rework"], kpi: "reworks", link: "/cockpit/projects" },
  { n: 38, name: "Planner (package → milestones + tasks)", system: "deliver", runs: "on order conversion", events: ["project.created"], kpi: "projects", link: "/cockpit/projects" },
  { n: 39, name: "QA judge", system: "deliver", runs: "on every delivery", agent: "qa-judge", needs: CLAUDE, events: ["qa.judged"], link: "/cockpit/qa" },
  { n: 40, name: "Risk-tiered approvals", system: "deliver", runs: "every project and delivery", kpi: "qaQueue", link: "/cockpit/qa" },
  { n: 41, name: "Customer milestone acceptance", system: "deliver", runs: "all tasks of a milestone accepted", events: ["milestone.ready", "milestone.accepted"], kpi: "milestones", link: "/cockpit/projects" },
  { n: 42, name: "Delivery watchdog", system: "deliver", runs: "hourly", job: "delivery.watch", events: ["milestone.reminded"], link: "/cockpit/projects" },
  { n: 43, name: "Change manager", system: "deliver", runs: "Javad prices, customer approves", events: ["change_request.quoted", "change_request.decided"], link: "/cockpit/projects" },
  { n: 44, name: "Closing + learning", system: "deliver", runs: "last milestone accepted", events: ["project.closed"], kpi: "lessons", link: "/cockpit/experiments" },
  { n: 45, name: "Protocol library", system: "deliver", runs: "drafts → Javad approves", events: ["protocol.approved"], kpi: "protocols", link: "/cockpit/protocols" },
  { n: 46, name: "Customer material intake", system: "deliver", runs: "customer chat + meeting notes", events: ["project_input.added"], kpi: "inputsWaiting", link: "/cockpit/projects" },
  { n: 47, name: "Identity removal", system: "data", runs: "on every input", events: ["project_input.decided"], kpi: "inputsWaiting", link: "/cockpit/projects" },
  { n: 48, name: "Assembly step", system: "deliver", runs: "two or more partners on a milestone", events: ["job.opened"], link: "/cockpit/projects" },
  { n: 49, name: "QA partner", system: "deliver", runs: "per project (qaBy)", events: ["job.opened"], link: "/cockpit/qa" },

  // partner
  { n: 29, name: "Partner applications + screening", system: "partner", runs: "public conversation", events: ["partner.applied", "partner.activated"], kpi: "applications", link: "/cockpit/partners" },
  { n: 30, name: "Job matching + offers", system: "partner", runs: "on each task; re-offers hourly", events: ["job.offered", "job.assigned"], kpi: "openJobs", link: "/cockpit/partners" },
  { n: 31, name: "Contact masking", system: "partner", runs: "every partner message", events: ["partner.message"], kpi: "flagged", link: "/cockpit/moderation" },
  { n: 32, name: "Delivery self-check + review", system: "partner", runs: "every delivery", events: ["delivery.submitted", "delivery.reviewed"], kpi: "firstPass", link: "/cockpit/qa" },
  { n: 33, name: "Levels + payouts", system: "partner", runs: "on acceptance", events: ["payout.paid"], kpi: "payoutsDue", link: "/cockpit/finance" },
  { n: 34, name: "Partner documents + expiry", system: "partner", runs: "partner adds, we check", events: ["partner.document_added"], kpi: "docsPending", link: "/cockpit/partners" },
  { n: 35, name: "Agent-partner API", system: "partner", runs: "agent partners pull work", kpi: "agentPartners", link: "/cockpit/api" },
  { n: 36, name: "Partner assistant + Today list", system: "partner", runs: "every partner message", agent: "partner-advisor", link: "/cockpit/agents" },

  // money
  { n: 53, name: "Payment requests + invoices", system: "money", runs: "first milestone, next milestones, monthly (hourly job)", job: "money", events: ["invoice.requested", "invoice.paid"], kpi: "openInvoices", link: "/cockpit/finance" },
  { n: 77, name: "Pay before each milestone", system: "money", runs: "milestone accepted → next billed; paid → it starts", events: ["milestone.started"], kpi: "unpaidMilestones", link: "/cockpit/finance" },
  { n: 54, name: "Dunning", system: "money", runs: "hourly with money", events: ["invoice.reminded"], kpi: "overdue", link: "/cockpit/finance" },
  { n: 57, name: "SEPA payout batch", system: "money", runs: "Javad downloads the file", kpi: "payoutsDue", link: "/cockpit/finance" },

  // data
  { n: 9, name: "Agent API keys", system: "data", runs: "Cockpit › API", kpi: "apiKeys", link: "/cockpit/api" },
  { n: 55, name: "Notification layer (email)", system: "data", runs: "every event → queue → mailer", needs: MAIL, kpi: "outbox", link: "/cockpit/outbox" },
  { n: 56, name: "Invites (set your password)", system: "data", runs: "new customer or partner", kpi: "invites", link: "/cockpit/outbox" },
  { n: 60, name: "GDPR erasure", system: "data", runs: "customer request data_delete", events: ["data.erased"], link: "/cockpit/customers" },
  { n: 65, name: "Data retention", system: "data", runs: "day 1 03:00", job: "data.retention", link: "/cockpit/agents#jobs" },

  // machine
  { n: 50, name: "Ops watchdog", system: "machine", runs: "hourly", job: "ops.watch", events: ["ops.flagged"], kpi: "stuck", link: "/cockpit" },
  { n: 51, name: "Process auditor", system: "machine", runs: "CI on every push", kpi: "gaps", link: "/cockpit/systems#audit" },
  { n: 66, name: "Orchestrator", system: "machine", runs: "worker / local mode, every minute", kpi: "jobsFailed", link: "/cockpit/agents#jobs" },
  { n: 67, name: "Daily brief", system: "machine", runs: "daily 08:00", job: "daily.report", needs: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_ADMIN_CHAT_ID"], link: "/cockpit" },
  { n: 68, name: "Agent budgets", system: "machine", runs: "hourly", job: "agents.budget", events: ["agent.paused"], kpi: "aiSpend", link: "/cockpit/agents" },
  { n: 69, name: "Experiments + lessons", system: "machine", runs: "daily 07:30", job: "experiments", events: ["experiment.ready", "experiment.decided"], kpi: "lessonsActive", link: "/cockpit/experiments" },
  { n: 71, name: "Emergency stop + switches", system: "machine", runs: "Cockpit › Systems", events: ["switch.changed"], link: "/cockpit/systems" },
  { n: 70, name: "Event outbox → Telegram + n8n", system: "machine", runs: "worker, continuous", needs: ["TELEGRAM_BOT_TOKEN"], kpi: "deadEvents", link: "/cockpit/systems" },
];
