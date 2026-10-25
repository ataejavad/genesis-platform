import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* ───────────── Auth (Better Auth tables) ───────────── */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // "admin" can use the cockpit; "member" is a customer user (portal, slice D)
  role: text("role").notNull().default("member"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/* ───────────── Tenants ───────────── */

export const orgKind = pgEnum("org_kind", ["internal", "customer", "partner"]);

// A tenant. Every private row in later modules carries org_id (+ RLS, doc 15 §4).
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  kind: orgKind("kind").notNull().default("customer"),
  country: text("country"),
  // customer orgs (step 5): trade slug as in the check-ups, dashboard language, where the customer came from
  industry: text("industry"),
  locale: text("locale"),
  prospectId: uuid("prospect_id"),
  // monthly loss in € from the first check-up: the starting point every result is compared with
  baselineEur: integer("baseline_eur"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const memberships = pgTable(
  "memberships",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] })],
);

/* ───────────── Markets (the Genesis "filter": industry × country × language) ───────────── */

export const marketStatus = pgEnum("market_status", ["candidate", "active", "paused", "retired"]);

export const markets = pgTable("markets", {
  id: uuid("id").primaryKey().defaultRandom(),
  // URL segment, e.g. "glass" — combined with locale: /de-de/glass
  slug: text("slug").notNull(),
  locale: text("locale").notNull(),
  industry: text("industry").notNull(),
  country: text("country").notNull(),
  name: text("name").notNull(),
  status: marketStatus("status").notNull().default("candidate"),
  // Market config file from Genesis stage 1: language, law, channels, pains, competitors
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [uniqueIndex("markets_locale_slug_idx").on(t.locale, t.slug)]);

/* ───────────── Content (single source of truth for every public page) ───────────── */

export const contentStatus = pgEnum("content_status", ["draft", "pending", "published", "rejected", "archived"]);

export const contentItems = pgTable(
  "content_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    marketId: uuid("market_id").references(() => markets.id),
    locale: text("locale").notNull(),
    // path below the locale, e.g. "glass/ai-quoting" (no leading slash)
    slug: text("slug").notNull(),
    type: text("type").notNull().default("page"),
    title: text("title").notNull(),
    summary: text("summary"),
    body: text("body").notNull(),
    status: contentStatus("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdBy: text("created_by").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("content_locale_slug_idx").on(t.locale, t.slug), index("content_status_idx").on(t.status)],
);

// Nothing is overwritten: every change to a content item is a new revision (doc 15 §4 rule 3).
export const contentRevisions = pgTable(
  "content_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentId: uuid("content_id")
      .notNull()
      .references(() => contentItems.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    body: text("body").notNull(),
    actor: text("actor").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("content_revision_version_idx").on(t.contentId, t.version)],
);

/* ───────────── Machine tables (shared by all modules) ───────────── */

export const approvalStatus = pgEnum("approval_status", ["pending", "approved", "rejected"]);

export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectType: text("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    // revision the decision applies to, so a stale approval can't publish newer text
    subjectVersion: integer("subject_version").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    status: approvalStatus("status").notNull().default("pending"),
    requestedBy: text("requested_by").notNull(),
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    note: text("note"),
    telegramMessageId: text("telegram_message_id"),
    createdAt: createdAt(),
  },
  (t) => [index("approvals_status_idx").on(t.status)],
);

// Transactional outbox: written in the same transaction as the change, dispatched by the worker.
export const events = pgTable(
  "events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    type: text("type").notNull(),
    subjectType: text("subject_type"),
    subjectId: text("subject_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    actor: text("actor").notNull(),
    createdAt: createdAt(),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
  },
  (t) => [index("events_undispatched_idx").on(t.id).where(sql`${t.dispatchedAt} is null`)],
);

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  // first characters of the key, shown in the cockpit to recognise it
  prefix: text("prefix").notNull(),
  hash: text("hash").notNull().unique(),
  // e.g. ["content:draft", "content:read"]
  scopes: text("scopes").array().notNull(),
  // agent keys can be limited to one market
  marketId: uuid("market_id").references(() => markets.id),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  agent: text("agent").notNull(),
  apiKeyId: uuid("api_key_id").references(() => apiKeys.id),
  action: text("action").notNull(),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  costEur: numeric("cost_eur", { precision: 10, scale: 4 }),
  meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: text("subject_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_subject_idx").on(t.subjectType, t.subjectId)],
);

/* ───────────── Leads (consent-based inbound from the public site) ───────────── */

// A visitor who asked for something on a hub (deadline list, reminders, check-up) and gave explicit consent.
// Prospects belong to no customer yet; org_id is set when the lead becomes a customer (slice D).
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organizations.id),
    email: text("email").notNull(),
    // where the lead came from, e.g. hub "installers" in "IT" through hook "scadenzario"
    industry: text("industry").notNull(),
    country: text("country").notNull(),
    locale: text("locale").notNull(),
    hook: text("hook").notNull(),
    answers: jsonb("answers").$type<Record<string, unknown>>().notNull().default({}),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    // Italy (Codice privacy art. 130) needs prior consent even for B2B email: keep the exact text agreed to.
    consentText: text("consent_text").notNull(),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    reminders: boolean("reminders").notNull().default(false),
    // double opt-in: set when the visitor clicks the confirmation email (email sending arrives with step 4)
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("leads_email_hub_idx").on(t.email, t.industry, t.country), index("leads_hub_idx").on(t.industry, t.country, t.createdAt)],
);

/* ───────────── Free check-up (doc 15 §6ه.6) ───────────── */

// One completed check-up. The id doubles as the private link to the report, so it is a random uuid.
export const checkups = pgTable(
  "checkups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organizations.id),
    industry: text("industry").notNull(),
    country: text("country").notNull(),
    locale: text("locale").notNull(),
    // which door the visitor came through: the form page or the concierge chat (KPI per entrance)
    entrance: text("entrance").notNull(),
    // page the visitor started from, e.g. "hub" or "home"
    source: text("source"),
    answers: jsonb("answers").$type<Record<string, unknown>>().notNull(),
    // what the visitor wrote in their own words (pains, context): the most valuable input for sales and product
    transcript: jsonb("transcript").$type<{ role: "user" | "assistant"; text: string }[]>().notNull().default([]),
    report: jsonb("report").$type<Record<string, unknown>>().notNull(),
    totalEur: integer("total_eur").notNull(),
    // set when the visitor unlocks the full plan with email + consent
    leadId: uuid("lead_id").references(() => leads.id),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
    callRequestedAt: timestamp("call_requested_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("checkups_created_idx").on(t.createdAt)],
);

/* ───────────── Outbound sales + CRM (step 4, doc 15 §6ب گام ۴) ───────────── */

// A company we sell to: found by the company agent (outbound) or created from a hub lead or a check-up (inbound).
// Our own sales data, not a customer's: org_id is set when the company signs (slice D).
export const prospects = pgTable(
  "prospects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organizations.id),
    name: text("name").notNull(),
    // normalised website host (or Maps place id) so the same firm found twice stays one row
    key: text("key").notNull(),
    website: text("website"),
    phone: text("phone"),
    industry: text("industry").notNull(),
    country: text("country").notNull(),
    region: text("region"),
    city: text("city"),
    nace: text("nace"),
    staff: integer("staff"),
    // "maps", "import", "hub", "checkup"
    source: text("source").notNull(),
    // need signals with the evidence URL for each (company agent, §2.6 ج)
    signals: jsonb("signals").$type<Record<string, unknown>>().notNull().default({}),
    score: numeric("score", { precision: 5, scale: 1 }),
    criterionScores: jsonb("criterion_scores").$type<Record<string, number>>(),
    // new → contacted → replied → interested → meeting → won | lost; do_not_contact stops everything
    stage: text("stage").notNull().default("new"),
    // which outreach sequence it is in: cold (LinkedIn + phone), warm (consented email), callback
    sequence: text("sequence"),
    leadId: uuid("lead_id").references(() => leads.id),
    checkupId: uuid("checkup_id").references(() => checkups.id),
    // Italy: phone numbers must be checked against the Registro Pubblico delle Opposizioni (valid 15 days)
    rpoCheckedAt: timestamp("rpo_checked_at", { withTimezone: true }),
    rpoListed: boolean("rpo_listed"),
    doNotContactReason: text("do_not_contact_reason"),
    note: text("note"),
    // funnel timestamps: counts per step come from these, so a later stage never hides an earlier one
    contactedAt: timestamp("contacted_at", { withTimezone: true }),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    interestedAt: timestamp("interested_at", { withTimezone: true }),
    meetingAt: timestamp("meeting_at", { withTimezone: true }),
    wonAt: timestamp("won_at", { withTimezone: true }),
    lostAt: timestamp("lost_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("prospects_key_idx").on(t.country, t.key), index("prospects_stage_idx").on(t.stage, t.industry)],
);

// Decision-makers at a prospect. Email is only used where the country's rules allow it (see outreach-rules).
export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prospectId: uuid("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
    name: text("name"),
    role: text("role"),
    email: text("email"),
    phone: text("phone"),
    linkedinUrl: text("linkedin_url"),
    // "website", "apollo", "lead", "manual"
    source: text("source").notNull(),
    // true when the person gave consent on our site (lead) or in a list Javad imports with its consent record
    emailConsent: boolean("email_consent").notNull().default(false),
    // legal basis Javad records for contacting this person: consent, legitimate_interest, existing_customer;
    // cold email and AI voice calls check it right before sending
    legalBasis: text("legal_basis"),
    // where the basis comes from, e.g. "site form 2026-10-23" or "fiera Milano 2026 list"
    basisSource: text("basis_source"),
    createdAt: createdAt(),
  },
  (t) => [index("contacts_prospect_idx").on(t.prospectId)],
);

// Channel switches per country (Javad turns them on in the cockpit). Off by default: cold email, AI voice calls.
export const channelSwitches = pgTable(
  "channel_switches",
  {
    country: text("country").notNull(),
    // "email-cold", "voice-ai", "letter"
    channel: text("channel").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    updatedBy: text("updated_by"),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.country, t.channel] })],
);

// One planned contact attempt in a sequence: an email, a LinkedIn note or a phone call.
export const touches = pgTable(
  "touches",
  {
    // random: doubles as the unsubscribe token in emails
    id: uuid("id").primaryKey().defaultRandom(),
    prospectId: uuid("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    step: text("step").notNull(),
    position: integer("position").notNull(),
    channel: text("channel").notNull(),
    locale: text("locale").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    // Persian version for Javad's review; never sent
    bodyFa: text("body_fa"),
    // draft (waits for approval) → approved → sent | done; skipped, blocked (rule), cancelled (reply or opt-out)
    status: text("status").notNull().default("draft"),
    blockedReason: text("blocked_reason"),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    approvedBy: text("approved_by"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    // what happened: e.g. "no_answer", "callback", "accepted", provider message id
    outcome: text("outcome"),
    createdAt: createdAt(),
  },
  (t) => [index("touches_due_idx").on(t.status, t.channel, t.dueAt), index("touches_prospect_idx").on(t.prospectId)],
);

// A page made for one company before we contact it (research 2026-10-23, Javad): public facts with sources, an
// estimated check-up, and a free starter persona it can talk to. Private link, not indexed; live once Javad
// approves the company's sequence.
export const companyPages = pgTable(
  "company_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prospectId: uuid("prospect_id").notNull().references(() => prospects.id, { onDelete: "cascade" }),
    // short random code in the link /<locale>/for/<code>
    code: text("code").notNull().unique(),
    locale: text("locale").notNull(),
    doc: jsonb("doc").$type<Record<string, unknown>>().notNull(),
    // draft → live (with the sequence approval) → archived (opt-out)
    status: text("status").notNull().default("draft"),
    views: integer("views").notNull().default(0),
    firstViewedAt: timestamp("first_viewed_at", { withTimezone: true }),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("company_pages_prospect_idx").on(t.prospectId)],
);

// Unified inbox: every message a company sends us or we send it outside sequences (WhatsApp first).
export const inbox = pgTable(
  "inbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prospectId: uuid("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
    channel: text("channel").notNull(),
    // "in" from the company, "out" from us (agent or person)
    direction: text("direction").notNull(),
    // phone number or address on the other side
    party: text("party").notNull(),
    body: text("body").notNull(),
    // who answered: "agent:whatsapp", "user:<id>"
    author: text("author"),
    providerId: text("provider_id"),
    createdAt: createdAt(),
  },
  (t) => [index("inbox_party_idx").on(t.channel, t.party, t.createdAt), uniqueIndex("inbox_provider_idx").on(t.channel, t.providerId)],
);

/* ───────────── Customer dashboard (step 5, doc 15 §6و) ───────────── */
// Every table here is private to one customer: org_id on each row (RLS with slice D hardening).

// A service the customer pays for, described by its result; the monthly fee is fixed (we sell results, not usage).
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    // product slug in the catalogue
    product: text("product").notNull(),
    plan: text("plan").notNull(),
    monthlyEur: integer("monthly_eur").notNull(),
    // active, paused, cancelled
    status: text("status").notNull().default("active"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("subscriptions_org_idx").on(t.orgId)],
);

// One measured result, written by the agent or person that delivered it (calls answered, quotes sent, € won).
export const outcomes = pgTable(
  "outcomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
    // metric id from src/server/portal-metrics.ts
    metric: text("metric").notNull(),
    value: numeric("value", { precision: 12, scale: 2, mode: "number" }).notNull(),
    // money this result is worth to the customer, by the rule of the metric (shown with the rule)
    eur: integer("eur").notNull().default(0),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    source: text("source").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("outcomes_org_idx").on(t.orgId, t.at)],
);

// Goals agreed with the customer (shared success plan): from where to where, by when.
export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    metric: text("metric").notNull(),
    // per-language title, e.g. {"it": "Nessuna chiamata persa", "fa": "..."}
    title: jsonb("title").$type<Record<string, string>>().notNull(),
    baseline: numeric("baseline", { precision: 12, scale: 2, mode: "number" }).notNull(),
    target: numeric("target", { precision: 12, scale: 2, mode: "number" }).notNull(),
    // current value as last measured
    current: numeric("current", { precision: 12, scale: 2, mode: "number" }),
    unit: text("unit").notNull(),
    due: timestamp("due", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("goals_org_idx").on(t.orgId)],
);

// Something waiting for the customer's yes: a delivery, a message we send in their name, a change.
export const customerApprovals = pgTable(
  "customer_approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    detail: text("detail"),
    link: text("link"),
    // pending, approved, changes
    status: text("status").notNull().default("pending"),
    note: text("note"),
    // step 7: approving a milestone or a change request of a project
    milestoneId: uuid("milestone_id"),
    changeRequestId: uuid("change_request_id"),
    createdBy: text("created_by").notNull(),
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("customer_approvals_org_idx").on(t.orgId, t.status)],
);

// What the customer asks for: a new problem to solve, a change, help, a data request.
export const customerRequests = pgTable(
  "customer_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    // solution, change, support, upgrade, data_delete
    kind: text("kind").notNull(),
    text: text("text").notNull(),
    // open, in_progress, done
    status: text("status").notNull().default("open"),
    // answer from our team, shown to the customer
    reply: text("reply"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("customer_requests_org_idx").on(t.orgId, t.status)],
);

// The dashboard conversation (home = chat). Messages keep the cards they showed, so history reads the same later.
export const portalThreads = pgTable(
  "portal_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("portal_threads_user_idx").on(t.orgId, t.userId, t.updatedAt)],
);

export const portalMessages = pgTable(
  "portal_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id").notNull().references(() => portalThreads.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    text: text("text").notNull(),
    cards: jsonb("cards").$type<unknown[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [index("portal_messages_thread_idx").on(t.threadId, t.createdAt)],
);

/* ───────────── Partner portal (step 6, doc 15 §6ب) ───────────── */
// Everyone who works for us or through us: a person, a company or an agent. Each partner has its own
// organization (kind partner); every row below is scoped by partner id.

export const partners = pgTable(
  "partners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "set null" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    // agent partners work through the API with their own key
    apiKeyId: uuid("api_key_id").references(() => apiKeys.id),
    // person, company, agent
    kind: text("kind").notNull(),
    // applied → active (or rejected); paused stops new offers
    status: text("status").notNull().default("applied"),
    name: text("name").notNull(),
    email: text("email").notNull(),
    country: text("country").notNull(),
    languages: text("languages").array().notNull().default(sql`'{}'::text[]`),
    skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
    // public links the partner gave (CV, portfolio, LinkedIn)
    links: text("links").array().notNull().default(sql`'{}'::text[]`),
    pitch: text("pitch"),
    // jobs at the same time the partner says they can take (their own tool; we never track hours)
    capacity: integer("capacity").notNull().default(2),
    // portal language
    locale: text("locale").notNull().default("en"),
    // screening result: score 0–100 and reasons, by rules or Claude
    screening: jsonb("screening").$type<{ score: number; why: string[]; by: string }>(),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("partners_email_idx").on(t.email), index("partners_status_idx").on(t.status)],
);

export const partnerDocuments = pgTable(
  "partner_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id").notNull().references(() => partners.id, { onDelete: "cascade" }),
    // cv, portfolio, vat, insurance, contract, nda, dpa, id
    kind: text("kind").notNull(),
    link: text("link").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    // pending, ok, rejected
    status: text("status").notNull().default("pending"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("partner_documents_partner_idx").on(t.partnerId)],
);

// What a partner sells us, at their price (our sale price lives in the catalogue).
export const partnerServices = pgTable(
  "partner_services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id").notNull().references(() => partners.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
    // fixed, hourly, monthly
    priceModel: text("price_model").notNull(),
    priceEur: integer("price_eur").notNull(),
    deliveryDays: integer("delivery_days").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("partner_services_partner_idx").on(t.partnerId)],
);

// A piece of work for a partner: internal (for us) or for a customer (white-label, customer shown by code).
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    brief: text("brief").notNull(),
    kind: text("kind").notNull().default("internal"),
    customerOrgId: uuid("customer_org_id").references(() => organizations.id, { onDelete: "set null" }),
    // what the partner sees instead of the customer's name, e.g. "C-1042 · installers · IT"
    customerCode: text("customer_code"),
    skills: text("skills").array().notNull().default(sql`'{}'::text[]`),
    language: text("language"),
    country: text("country"),
    // the job touches personal data: only partners with a signed DPA in the EU/adequate countries
    personalData: boolean("personal_data").notNull().default(false),
    // what we pay the partner; our sale price stays in the cockpit
    payEur: integer("pay_eur").notNull(),
    priceEur: integer("price_eur"),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    // acceptance criteria the partner self-checks before delivering
    checklist: jsonb("checklist").$type<string[]>().notNull().default([]),
    // open → offered → assigned → delivered → accepted (→ paid) | cancelled
    status: text("status").notNull().default("open"),
    partnerId: uuid("partner_id").references(() => partners.id),
    // step 7: a task of a project, checked against a fixed protocol version
    projectId: uuid("project_id"),
    milestoneId: uuid("milestone_id"),
    protocolVersionId: uuid("protocol_version_id"),
    // work; assemble (puts the parts of a milestone together); qa (checks another partner's delivery)
    role: text("role").notNull().default("work"),
    reviewsDeliveryId: uuid("reviews_delivery_id"),
    createdBy: text("created_by").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("jobs_status_idx").on(t.status), index("jobs_partner_idx").on(t.partnerId), index("jobs_project_idx").on(t.projectId)],
);

export const jobOffers = pgTable(
  "job_offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    partnerId: uuid("partner_id").notNull().references(() => partners.id, { onDelete: "cascade" }),
    // match score 0–100 and the reasons shown to the partner (algorithmic transparency)
    fit: integer("fit").notNull(),
    why: jsonb("why").$type<{ factor: string; points: number; max: number }[]>().notNull(),
    // offered, accepted, declined, withdrawn
    status: text("status").notNull().default("offered"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("job_offers_job_partner_idx").on(t.jobId, t.partnerId), index("job_offers_partner_idx").on(t.partnerId, t.status)],
);

export const deliveries = pgTable(
  "deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id").notNull().references(() => jobs.id, { onDelete: "cascade" }),
    partnerId: uuid("partner_id").notNull().references(() => partners.id),
    version: integer("version").notNull(),
    link: text("link").notNull(),
    note: text("note"),
    // the partner's self-check against the checklist: index → done
    selfCheck: jsonb("self_check").$type<boolean[]>().notNull().default([]),
    // submitted, accepted, changes
    status: text("status").notNull().default("submitted"),
    review: text("review"),
    quality: integer("quality"),
    onTime: boolean("on_time"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("deliveries_job_idx").on(t.jobId)],
);

export const payouts = pgTable(
  "payouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id").notNull().references(() => partners.id),
    jobId: uuid("job_id").references(() => jobs.id),
    amountEur: integer("amount_eur").notNull(),
    // due, paid
    status: text("status").notNull().default("due"),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("payouts_partner_idx").on(t.partnerId), uniqueIndex("payouts_job_idx").on(t.jobId)],
);

// Messages between a partner and us. Contact details are masked in what the other side reads.
export const partnerMessages = pgTable(
  "partner_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partnerId: uuid("partner_id").notNull().references(() => partners.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    // partner or us
    author: text("author").notNull(),
    body: text("body").notNull(),
    // what the other side sees (contact details masked)
    shown: text("shown").notNull(),
    flagged: boolean("flagged").notNull().default(false),
    // a partner asking a person to review an automated decision (offer, rank, screening)
    reviewRequest: boolean("review_request").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("partner_messages_partner_idx").on(t.partnerId, t.createdAt)],
);

/* ───────────── Delivery: protocols, packages, orders, projects (step 7, doc 15 §6د, §6د2) ───────────── */

// One acceptance criterion: outcome, not method (freelancers decide how). Checked by a rule, the QA judge or a person.
export type Criterion = { text: string; texts?: Record<string, string>; mandatory: boolean; weight: number; method: "auto" | "judge" | "human" };

// A kind of work we deliver, with versions; every project task is checked against one approved version.
export const protocols = pgTable("protocols", {
  id: uuid("id").primaryKey().defaultRandom(),
  // PR-02
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  // service and classification (doc 13): NACE industry, APQC process
  nace: text("nace"),
  apqc: text("apqc"),
  createdAt: createdAt(),
});

export const protocolVersions = pgTable(
  "protocol_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    protocolId: uuid("protocol_id").notNull().references(() => protocols.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    // draft → approved (by Javad; the previous approved one is retired) | retired
    status: text("status").notNull().default("draft"),
    goal: text("goal").notNull(),
    inputs: jsonb("inputs").$type<string[]>().notNull().default([]),
    deliverables: jsonb("deliverables").$type<string[]>().notNull().default([]),
    // fixed rules in every job: white-label, GDPR, AI disclosure (AI Act art. 50), brand tone
    rules: jsonb("rules").$type<string[]>().notNull().default([]),
    criteria: jsonb("criteria").$type<Criterion[]>().notNull(),
    // how we would do it: advice for freelancers, instruction only for staff (bogus self-employment)
    guidance: text("guidance"),
    standardDays: integer("standard_days").notNull(),
    changeNote: text("change_note"),
    createdBy: text("created_by").notNull(),
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("protocol_versions_idx").on(t.protocolId, t.version)],
);

export type TaskTemplate = { title: string; brief: string; protocol: string; skills: string[]; payEur: number; days: number; milestone: number };
export type MilestoneTemplate = { title: string; titles?: Record<string, string>; sharePct: number };

// The catalogue: a product we sell = protocols + task template + milestones + price. No package, no sale.
export const servicePackages = pgTable("service_packages", {
  id: uuid("id").primaryKey().defaultRandom(),
  // product slug, as in the marketplace and subscriptions
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  titles: jsonb("titles").$type<Record<string, string>>().notNull().default({}),
  // one-off setup price and the monthly fee after go-live (every service has a monthly fee)
  setupEur: integer("setup_eur").notNull(),
  monthlyEur: integer("monthly_eur").notNull(),
  plan: text("plan").notNull().default("Standard"),
  tasks: jsonb("tasks").$type<TaskTemplate[]>().notNull(),
  milestones: jsonb("milestones").$type<MilestoneTemplate[]>().notNull(),
  personalData: boolean("personal_data").notNull().default(true),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

// Every way in (marketplace, dashboard, CRM won, customer request) ends here; one click turns it into a project.
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // the customer when known (dashboard); otherwise the contact below
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "set null" }),
    packageSlug: text("package_slug").notNull(),
    // market, portal, crm, request, cockpit
    source: text("source").notNull(),
    company: text("company"),
    email: text("email"),
    vat: text("vat"),
    country: text("country"),
    industry: text("industry"),
    locale: text("locale").notNull().default("en"),
    note: text("note"),
    // new → converted | rejected
    status: text("status").notNull().default("new"),
    projectId: uuid("project_id"),
    createdAt: createdAt(),
  },
  (t) => [index("orders_status_idx").on(t.status)],
);

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // P-1001
    code: text("code").notNull().unique(),
    // the customer (null for internal projects)
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    packageSlug: text("package_slug"),
    // customer or internal
    kind: text("kind").notNull().default("customer"),
    // running → delivered (all milestones accepted) → closed | cancelled
    status: text("status").notNull().default("running"),
    // low, medium, high, with the reasons (who approves what)
    risk: text("risk").notNull(),
    riskWhy: jsonb("risk_why").$type<string[]>().notNull().default([]),
    priceEur: integer("price_eur").notNull(),
    monthlyEur: integer("monthly_eur").notNull().default(0),
    // planned cost (sum of partner pay); actual cost is in project_costs
    budgetEur: integer("budget_eur").notNull(),
    language: text("language").notNull().default("en"),
    country: text("country"),
    orderId: uuid("order_id"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    // what we learned at closing (failed criteria, delays): input for better protocols and estimates
    lessons: jsonb("lessons").$type<string[]>().notNull().default([]),
    // who checks deliveries: judge (our AI, a person when unsure), partner (a QA company or agent), us (always a person)
    qaBy: text("qa_by").notNull().default("judge"),
    createdBy: text("created_by").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("projects_org_idx").on(t.orgId), index("projects_status_idx").on(t.status)],
);

// What the customer (or we, from a meeting) gave for a project. Partners only ever see the cleaned version.
export const projectInputs = pgTable(
  "project_inputs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    // which protocol input this answers ("Opening hours and holidays"), or "Other"
    label: text("label").notNull(),
    // chat, meeting, file
    source: text("source").notNull(),
    text: text("text"),
    // the text with the customer's identity replaced by placeholders, and what was replaced (kinds only)
    cleanText: text("clean_text"),
    removed: jsonb("removed").$type<string[]>().notNull().default([]),
    fileName: text("file_name"),
    fileType: text("file_type"),
    fileSize: integer("file_size"),
    fileKey: text("file_key"),
    // shared (partners see it), check (a person looks first: files we cannot clean), withheld
    status: text("status").notNull(),
    createdBy: text("created_by").notNull(),
    decidedBy: text("decided_by"),
    createdAt: createdAt(),
  },
  (t) => [index("project_inputs_project_idx").on(t.projectId)],
);

export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "set null" }),
    seq: integer("seq").notNull(),
    title: text("title").notNull(),
    amountEur: integer("amount_eur").notNull(),
    // open → ready (all tasks accepted; customer asked) → accepted (invoiceable, step 8) | changes
    status: text("status").notNull().default("open"),
    approvalId: uuid("approval_id"),
    readyAt: timestamp("ready_at", { withTimezone: true }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    remindedAt: timestamp("reminded_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("milestones_project_idx").on(t.projectId)],
);

// Every QA look at a delivery: the judge's or a person's, per criterion. Person vs judge on the same delivery = calibration.
export const qaReviews = pgTable(
  "qa_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deliveryId: uuid("delivery_id").notNull().references(() => deliveries.id, { onDelete: "cascade" }),
    // judge, rules, user:<id>
    by: text("by").notNull(),
    results: jsonb("results").$type<{ idx: number; result: "pass" | "fail" | "unsure"; note?: string }[]>().notNull(),
    // accept, changes, review (a person must look)
    verdict: text("verdict").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("qa_reviews_delivery_idx").on(t.deliveryId)],
);

// A scope change: priced and timed, then approved by the customer before any work.
export const changeRequests = pgTable(
  "change_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "set null" }),
    text: text("text").notNull(),
    priceEur: integer("price_eur").notNull(),
    days: integer("days").notNull(),
    // quoted → approved | rejected
    status: text("status").notNull().default("quoted"),
    approvalId: uuid("approval_id"),
    createdBy: text("created_by").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("change_requests_project_idx").on(t.projectId)],
);

// Actual cost per project: partner pay, model use, people, tools. Price − cost = real margin.
export const projectCosts = pgTable(
  "project_costs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    // partner, model, human, tool
    kind: text("kind").notNull(),
    amountEur: integer("amount_eur").notNull(),
    note: text("note"),
    jobId: uuid("job_id"),
    createdAt: createdAt(),
  },
  (t) => [index("project_costs_project_idx").on(t.projectId), uniqueIndex("project_costs_job_idx").on(t.jobId)],
);
