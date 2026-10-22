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
