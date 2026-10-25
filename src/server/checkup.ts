import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { and, count, eq, gte, isNotNull } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { checkups } from "@/db/schema";
import { LOCALES } from "@/config/locales";
import { products } from "@/mock/site";
import type { Actor } from "./actor";
import { AppError, conflict, notFound } from "./errors";
import { planEnv, prospectFromCheckup } from "./crm";
import { audit, emit } from "./events";
import { hubSlug, loadFacts, loadResearch } from "./hubs";
import { insertLead, monthStart } from "./leads";

/*
 * Free check-up (doc 15 §6ه.6): one engine, two entrances (form page and concierge chat).
 * Questions and savings rules are templates in Git (data/checkup/<industry>.json); every number in the report
 * is a visible product of the visitor's answers, official sector facts and labelled assumptions.
 */

const text = z.object({ en: z.string().min(1) }).catchall(z.string());
const factor = z.union([
  z.object({ q: z.string(), label: text }),
  z.object({ const: z.number(), label: text }),
  // a market-selection fact in percent (e.g. marginPct), used as a share
  z.object({ fact: z.string(), label: text }),
]);
export const checkupDefSchema = z.object({
  industry: z.string(),
  version: z.number().int(),
  minutes: z.number(),
  questions: z.array(
    z.object({
      id: z.string(),
      multi: z.boolean().default(false),
      // answers become tags that pick the matching hub deadlines
      tags: z.boolean().default(false),
      label: text,
      // words: synonyms in any language that let the chat understand a typed answer
      options: z.array(z.object({ id: z.string(), value: z.number().optional(), label: text, words: z.array(z.string()).default([]) })).min(1),
    }),
  ),
  leaks: z.array(z.object({ id: z.string(), solution: z.string(), title: text, why: text, factors: z.array(factor).min(1) })).min(1),
});
export type CheckupDef = z.infer<typeof checkupDefSchema>;

const DIR = "data/checkup";

export function checkupIndustries(): string[] {
  return existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")) : [];
}

export function loadCheckupDef(industry: string): CheckupDef | null {
  if (!/^[a-z0-9-]+$/.test(industry)) return null;
  const file = path.join(DIR, `${industry}.json`);
  return existsSync(file) ? checkupDefSchema.parse(JSON.parse(readFileSync(file, "utf8"))) : null;
}

const tr = (l: { en: string } & Record<string, string>, lang: string) => l[lang] || l.en;

// The questions in one language, for the form and the chat.
export function localizeDef(def: CheckupDef, lang: string) {
  return {
    industry: def.industry,
    minutes: def.minutes,
    questions: def.questions.map((q) => ({ id: q.id, multi: q.multi, label: tr(q.label, lang), options: q.options.map((o) => ({ id: o.id, label: tr(o.label, lang), words: o.words })) })),
  };
}
export type LocalizedCheckup = ReturnType<typeof localizeDef>;

/* ───────────── Scoring ───────────── */

export const answersSchema = z.record(z.string().max(40), z.union([z.string().max(40), z.array(z.string().max(40)).max(10)]));
export type Answers = z.infer<typeof answersSchema>;

export type Report = {
  industry: string;
  country: string;
  lang: string;
  version: number;
  total: number;
  // estimated yearly loss as a share of the payroll, so the number means something for every firm size
  payrollPct: number | null;
  leadScore: number;
  leaks: { id: string; title: string; why: string; amount: number; factors: { label: string; value: number }[]; solution: string; priceMonth: number | null; payback: number | null }[];
  deadlines: { id: string; title: string; date: string | null; url: string }[];
  advice?: string;
};

const value = (def: CheckupDef, answers: Answers, qid: string) => {
  const q = def.questions.find((x) => x.id === qid);
  const a = answers[qid];
  return q?.options.find((o) => o.id === a)?.value;
};

export function validateAnswers(def: CheckupDef, answers: Answers) {
  for (const q of def.questions) {
    const a = answers[q.id];
    const ids = new Set(q.options.map((o) => o.id));
    if (q.tags) {
      if (a !== undefined && (!Array.isArray(a) || a.some((x) => !ids.has(x)))) throw new AppError(400, "invalid", `bad answer for ${q.id}`);
    } else if (typeof a !== "string" || !ids.has(a)) {
      throw new AppError(400, "invalid", `missing answer for ${q.id}`);
    }
  }
}

export function computeReport(def: CheckupDef, answers: Answers, ctx: { country: string; lang: string; locale: string; now?: Date }): Report {
  validateAnswers(def, answers);
  const research = loadResearch().find((r) => r.industry === def.industry && r.country === ctx.country);
  const facts = research ? loadFacts(research) : null;
  const leaks = def.leaks
    .map((leak) => {
      const factors = leak.factors.map((f) => {
        const v = "q" in f ? value(def, answers, f.q) : "const" in f ? f.const : (facts?.facts[f.fact] ?? 0) / 100;
        return { label: tr(f.label, ctx.lang), value: v ?? 0 };
      });
      const amount = Math.round(factors.reduce((p, f) => p * f.value, 1));
      const price = products.find((p) => p.slug === leak.solution)?.plans[0]?.price ?? null;
      return {
        id: leak.id,
        title: tr(leak.title, ctx.lang),
        why: tr(leak.why, ctx.lang),
        amount,
        factors,
        solution: leak.solution,
        priceMonth: price,
        // how many times the yearly saving covers the yearly price
        payback: price ? Math.round((amount / (price * 12)) * 10) / 10 : null,
      };
    })
    .filter((l) => l.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 3);
  const total = leaks.reduce((s, l) => s + l.amount, 0);
  const team = value(def, answers, "team");
  const hourly = value(def, answers, "hourly");
  const payroll = team && hourly ? team * hourly * 1720 : null;
  const tags = new Set(def.questions.filter((q) => q.tags).flatMap((q) => [answers[q.id] ?? []].flat()));
  const today = (ctx.now ?? new Date()).toISOString().slice(0, 10);
  const deadlines = (research?.deadlines ?? [])
    .filter((d) => (d.tags.includes("all") || d.tags.some((t) => tags.has(t))) && (!d.date || d.date >= today || d.tags.includes("all")))
    .map((d) => ({ id: d.id, title: tr(d.title, ctx.lang), date: d.date, url: `/${ctx.locale}/${hubSlug(def.industry, ctx.country)}#d-${d.id}` }));
  return {
    industry: def.industry,
    country: ctx.country,
    lang: ctx.lang,
    version: def.version,
    total,
    payrollPct: payroll ? Math.round((total / payroll) * 1000) / 10 : null,
    // For sales priority only (never shown): size of the problem plus size of the firm.
    leadScore: Math.min(100, Math.round(total / 1000) + Math.min(30, (team ?? 0) / 2)),
    leaks,
    deadlines,
  };
}

// Before the visitor leaves an email they see the problem and its size; the plan (solutions, prices) needs consent.
export function lockedView(r: Report) {
  return { ...r, leadScore: undefined, leaks: r.leaks.map(({ solution: _s, priceMonth: _p, payback: _b, ...l }) => l) };
}
export type LockedReport = ReturnType<typeof lockedView>;

/* ───────────── Storage and the funnel ───────────── */

const localeEnum = z.enum(Object.keys(LOCALES) as [keyof typeof LOCALES, ...(keyof typeof LOCALES)[]]);
export const checkupInput = z.object({
  industry: z.string(),
  country: z.string().length(2).transform((c) => c.toUpperCase()),
  locale: localeEnum,
  // both doors are the same conversation: the check-up page or the chat on the home page
  entrance: z.enum(["page", "home"]),
  source: z.string().max(40).optional(),
  answers: answersSchema,
  transcript: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) })).max(80).default([]),
});

export async function startCheckup(db: Db, actor: Actor, raw: unknown) {
  const parsed = checkupInput.safeParse(raw);
  if (!parsed.success) throw new AppError(400, "invalid", parsed.error.issues[0]?.message ?? "invalid input");
  const input = parsed.data;
  const def = loadCheckupDef(input.industry);
  if (!def) throw notFound("check-up for this industry");
  const report = computeReport(def, input.answers, { country: input.country, lang: LOCALES[input.locale].lang, locale: input.locale });
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(checkups)
      .values({ ...input, report, totalEur: report.total })
      .returning({ id: checkups.id });
    const facts = { industry: input.industry, country: input.country, entrance: input.entrance, source: input.source ?? null, totalEur: report.total };
    await emit(tx, actor, "checkup.completed", { type: "checkup", id: row.id }, facts);
    await audit(tx, actor, "checkup.completed", { type: "checkup", id: row.id }, null, facts);
    return { id: row.id, report: lockedView(report) };
  });
}

export async function getCheckup(db: Db, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const [row] = await db.select().from(checkups).where(eq(checkups.id, id));
  return row ? { ...row, report: row.report as unknown as Report } : null;
}

/** Email + explicit consent unlock the plan; the visitor becomes a lead tied to this check-up. */
export async function unlockCheckup(db: Db, actor: Actor, id: string, raw: Record<string, unknown>, advice?: (r: Report) => Promise<string | null>) {
  const found = await getCheckup(db, id);
  if (!found) throw notFound("check-up");
  // Optional Claude-written summary; outside the transaction because it can take seconds.
  const extra = !found.unlockedAt && advice ? await advice(found.report).catch(() => null) : null;
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(checkups).where(eq(checkups.id, id)).for("update");
    const report = { ...(row.report as unknown as Report), ...(extra ? { advice: extra } : {}) };
    const tags = Object.values(row.answers).flatMap((a) => (Array.isArray(a) ? a : []));
    const lead = await insertLead(tx, actor, {
      ...raw,
      industry: row.industry,
      country: row.country,
      locale: row.locale,
      hook: "checkup",
      answers: { checkup: row.id, totalEur: row.totalEur, entrance: row.entrance },
      tags,
    });
    await tx.update(checkups).set({ leadId: lead.id, unlockedAt: row.unlockedAt ?? new Date(), report }).where(eq(checkups.id, id));
    // Into the CRM with the warm sequence (emails wait for Javad's approval).
    await prospectFromCheckup(tx, actor, id, planEnv());
    const facts = { industry: row.industry, entrance: row.entrance, totalEur: row.totalEur, leadScore: report.leadScore };
    await emit(tx, actor, "checkup.unlocked", { type: "checkup", id }, { ...facts, leadId: lead.id });
    await audit(tx, actor, "checkup.unlocked", { type: "checkup", id }, null, facts);
    return report;
  });
}

export async function requestCall(db: Db, actor: Actor, id: string, raw: { phone?: unknown } = {}) {
  const phone = z.string().trim().min(6).max(80).optional().parse(raw.phone ?? undefined);
  if (!z.uuid().safeParse(id).success) throw notFound("check-up");
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(checkups).where(eq(checkups.id, id)).for("update");
    if (!row) throw notFound("check-up");
    if (!row.unlockedAt || !row.leadId) throw conflict("leave an email first");
    if (row.callRequestedAt) return { already: true };
    await tx.update(checkups).set({ callRequestedAt: new Date() }).where(eq(checkups.id, id));
    // A call task due now; the worker also pings Javad on Telegram (answer within 5 minutes).
    await prospectFromCheckup(tx, actor, id, planEnv(), true, phone);
    await emit(tx, actor, "checkup.call_requested", { type: "checkup", id }, { industry: row.industry, entrance: row.entrance, leadId: row.leadId, totalEur: row.totalEur });
    await audit(tx, actor, "checkup.call_requested", { type: "checkup", id }, null, { leadId: row.leadId });
    return { already: false };
  });
}

// KPI per entrance this month: completed → unlocked (lead) → call requested.
export async function checkupFunnel(db: Db, now = new Date()) {
  const since = gte(checkups.createdAt, monthStart(now));
  const by = (where = since) =>
    db.select({ industry: checkups.industry, entrance: checkups.entrance, n: count() }).from(checkups).where(where).groupBy(checkups.industry, checkups.entrance);
  const [done, unlocked, calls] = await Promise.all([by(), by(and(since, isNotNull(checkups.unlockedAt))), by(and(since, isNotNull(checkups.callRequestedAt)))]);
  const key = (r: { industry: string; entrance: string }) => `${r.industry}|${r.entrance}`;
  const get = (rows: typeof done, k: string) => rows.find((r) => key(r) === k)?.n ?? 0;
  return done.map((r) => ({ industry: r.industry, entrance: r.entrance, completed: r.n, unlocked: get(unlocked, key(r)), calls: get(calls, key(r)) }));
}
