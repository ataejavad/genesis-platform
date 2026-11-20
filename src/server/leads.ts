import { and, count, gte, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db, DbOrTx } from "@/db";
import { leads } from "@/db/schema";
import { LOCALES } from "@/config/locales";
import type { Actor } from "./actor";
import { AppError } from "./errors";
import { audit, emit } from "./events";

export const leadInput = z.object({
  email: z.email().max(200).transform((e) => e.trim().toLowerCase()),
  industry: z.string().regex(/^[a-z0-9-]+$/).max(60),
  country: z.string().length(2).transform((c) => c.toUpperCase()),
  locale: z.enum(Object.keys(LOCALES) as [keyof typeof LOCALES, ...(keyof typeof LOCALES)[]]),
  hook: z.string().max(60),
  answers: z.record(z.string().max(40), z.union([z.string().max(200), z.number(), z.array(z.string().max(60)).max(20)])).default({}),
  tags: z.array(z.string().max(40)).max(20).default([]),
  // Explicit, unticked-by-default consent; the exact sentence shown is stored with the lead.
  consent: z.literal(true),
  consentText: z.string().min(10).max(1000),
  reminders: z.boolean().default(false),
  // honeypot: people never see this field, bots fill it
  website: z.string().max(0).optional(),
});

/** Saves a hub sign-up. One row per email and hub: asking again updates the answers instead of duplicating. */
export async function captureLead(db: Db, actor: Actor, raw: unknown) {
  return db.transaction((tx) => insertLead(tx, actor, raw));
}

// Same as captureLead, inside a transaction the caller already holds (e.g. unlocking a check-up).
export async function insertLead(tx: DbOrTx, actor: Actor, raw: unknown) {
  const parsed = leadInput.safeParse(raw);
  if (!parsed.success) throw new AppError(400, "invalid", parsed.error.issues[0]?.message ?? "invalid input");
  const { consent: _consent, website: _website, ...input } = parsed.data;
  const now = new Date();
  const [row] = await tx
    .insert(leads)
    .values({ ...input, consentAt: now })
    .onConflictDoUpdate({
      target: [leads.email, leads.industry, leads.country],
      set: { locale: input.locale, hook: input.hook, answers: input.answers, tags: input.tags, consentText: input.consentText, consentAt: now, reminders: input.reminders, unsubscribedAt: null },
    })
    // xmax is 0 only for a freshly inserted row, so this tells a new lead from a returning one.
    .returning({ id: leads.id, inserted: sql<boolean>`(xmax = 0)` });
  const repeat = !row.inserted;
  // No email address in events or audit: they are forwarded to automations; the lead row is the only copy.
  const facts = { industry: input.industry, country: input.country, hook: input.hook, tags: input.tags, reminders: input.reminders, repeat };
  await emit(tx, actor, "lead.captured", { type: "lead", id: row.id }, facts);
  await audit(tx, actor, repeat ? "lead.updated" : "lead.captured", { type: "lead", id: row.id }, null, facts);
  return { id: row.id, repeat };
}

export const monthStart = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

// Hub KPI: opted-in leads this month per hub (compared with the target in the hub's research file).
export async function leadsThisMonth(db: Db, now = new Date()) {
  const rows = await db
    .select({ industry: leads.industry, country: leads.country, n: count() })
    .from(leads)
    .where(and(gte(leads.createdAt, monthStart(now)), isNull(leads.unsubscribedAt)))
    .groupBy(leads.industry, leads.country);
  return new Map(rows.map((r) => [`${r.industry}-${r.country}`, r.n]));
}
