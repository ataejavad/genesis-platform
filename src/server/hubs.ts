import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { contentItems } from "@/db/schema";
import { LOCALES, type Locale } from "@/config/locales";
import { getPublished } from "./content";
import { leadsThisMonth } from "./leads";

/*
 * Industry hubs (doc 15 §6ه.2): one template, many topics. The hub-builder agent turns a research file
 * (data/hubs/research/<date>/<industry>-<cc>.json) plus market-selection facts into one page per locale,
 * checks every claim against the sourcing rules below, and sends it as a draft. Nothing is live until approved.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
// Every research text has English; other languages fall back to it.
const text = z.object({ en: z.string().min(1) }).catchall(z.string());
export const sourceSchema = z.object({
  name: z.string().min(1),
  url: z.url(),
  date: isoDate,
  kind: z.enum(["official", "press", "association"]),
});
export type Source = z.infer<typeof sourceSchema>;

const option = <T extends z.ZodType>(t: T) => z.object({ tag: z.string(), label: t });
const question = <T extends z.ZodType>(t: T) => z.object({ id: z.string(), multi: z.boolean(), label: t, options: z.array(option(t)).min(1) });
const calc = <T extends z.ZodType>(t: T) =>
  z.object({
    kind: z.literal("uplift"),
    when: z.string(),
    label: t,
    // Extra deduction rate per investment band, e.g. 1.8 = 180% of the cost on top of normal depreciation.
    bands: z.array(z.object({ upTo: z.number().positive(), rate: z.number().nonnegative() })).min(1),
    taxRate: z.number().positive().max(1),
    result: t,
  });

export const researchSchema = z.object({
  industry: z.string().regex(/^[a-z0-9-]+$/),
  country: z.string().length(2),
  nace: z.array(z.string()).min(1),
  researchedAt: isoDate,
  researcher: z.string(),
  name: text,
  tagline: text,
  overview: z.object({ text, sources: z.array(sourceSchema) }),
  pains: z.array(z.object({ text, sources: z.array(sourceSchema) })),
  deadlines: z.array(
    z.object({ id: z.string(), tags: z.array(z.string()), date: isoDate.nullable(), title: text, what: text, offer: text, sources: z.array(sourceSchema) }),
  ),
  news: z.array(z.object({ date: isoDate, publisher: z.string(), url: z.url(), title: text, takeaway: text })),
  solutions: z.array(z.object({ title: text, outcome: text })),
  hook: z.object({ id: z.string(), title: text, promise: text, questions: z.array(question(text)).min(1), calc: calc(text).optional() }),
  kpi: z.object({ name: z.string(), target: z.number().int().positive(), northStar: z.string() }),
});
export type HubResearch = z.infer<typeof researchSchema>;

// Market-selection facts for one NACE division (from data/market-selection/runs/<date>/industry-<CC>.json).
export const factsSchema = z.object({
  facts: z.record(z.string(), z.number()),
  period: z.string(),
  sources: z.array(z.string()),
});
export type HubFacts = z.infer<typeof factsSchema>;

const str = z.string();
export const hubDocSchema = z.object({
  kind: z.literal("industry-hub"),
  v: z.literal(1),
  industry: z.string(),
  country: z.string(),
  nace: z.array(z.string()),
  lang: z.string(),
  researchedAt: isoDate,
  name: str,
  tagline: str,
  overview: z.object({ text: str, sources: z.array(sourceSchema) }),
  stats: z.array(z.object({ key: z.enum(["firms", "turnover", "employment", "aiUse", "vacancy", "growth"]), value: z.number(), period: z.string(), source: str })),
  pains: z.array(z.object({ text: str, sources: z.array(sourceSchema) })),
  deadlines: z.array(z.object({ id: str, tags: z.array(str), date: isoDate.nullable(), title: str, what: str, offer: str, sources: z.array(sourceSchema) })),
  news: z.array(z.object({ date: isoDate, publisher: str, url: z.url(), title: str, takeaway: str })),
  solutions: z.array(z.object({ title: str, outcome: str })),
  hook: z.object({ id: str, title: str, promise: str, questions: z.array(question(str)), calc: calc(str).optional() }),
  kpi: z.object({ name: str, target: z.number(), northStar: str }),
});
export type HubDoc = z.infer<typeof hubDocSchema>;

/* ───────────── Sourcing rules ───────────── */

export type HubIssue = { level: "error" | "dropped" | "warn"; where: string; why: string };

// How old a block may be before the agent drops it or flags the hub as stale (days).
export const MAX_AGE = { news: 90, research: 14, passedDeadline: 30 };

const host = (url: string) => new URL(url).hostname.replace(/^www\./, "");
const days = (from: string, to: Date) => (to.getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000;

// A rule or deadline needs one official source, or two independent publishers that agree.
export const ruleIsBacked = (sources: Source[]) =>
  sources.some((s) => s.kind === "official") || new Set(sources.map((s) => host(s.url))).size >= 2;

/**
 * Applies the sourcing and freshness rules. Blocks that fail are dropped (never published unsupported);
 * a hub without a deadline or a hook cannot be published at all, because it would have no way to win customers.
 */
export function checkResearch(r: HubResearch, now: Date): { research: HubResearch; issues: HubIssue[] } {
  const issues: HubIssue[] = [];
  const deadlines = r.deadlines.filter((d) => {
    if (!ruleIsBacked(d.sources)) {
      issues.push({ level: "dropped", where: `deadline ${d.id}`, why: "needs an official source or two independent sources" });
      return false;
    }
    if (d.date && days(d.date, now) > MAX_AGE.passedDeadline) {
      issues.push({ level: "dropped", where: `deadline ${d.id}`, why: `date ${d.date} passed` });
      return false;
    }
    return true;
  });
  const pains = r.pains.filter((p, i) => {
    if (p.sources.length) return true;
    issues.push({ level: "dropped", where: `pain ${i + 1}`, why: "no source" });
    return false;
  });
  const news = r.news.filter((n) => {
    if (days(n.date, now) <= MAX_AGE.news) return true;
    issues.push({ level: "dropped", where: `news ${n.publisher} ${n.date}`, why: `older than ${MAX_AGE.news} days` });
    return false;
  });
  if (!r.overview.sources.some((s) => s.kind === "official")) issues.push({ level: "warn", where: "overview", why: "market figures should come from an official source" });
  if (days(r.researchedAt, now) > MAX_AGE.research) issues.push({ level: "warn", where: "research", why: `older than ${MAX_AGE.research} days; run the research step again` });
  if (!deadlines.length) issues.push({ level: "error", where: "deadlines", why: "no backed deadline left: the hook has nothing to offer" });
  return { research: { ...r, deadlines, pains, news }, issues };
}

/* ───────────── Building one page per locale ───────────── */

// Locales a hub is written for; a language without its own text uses English.
export const HUB_LOCALES = Object.keys(LOCALES) as Locale[];
export const hubSlug = (industry: string, country: string) => `hub/${industry}/${country.toLowerCase()}`;

// Which market-selection fact feeds which hub number, and the official dataset behind it.
const STATS: { key: HubDoc["stats"][number]["key"]; field: string; source: string }[] = [
  { key: "firms", field: "targetFirms", source: "Eurostat sbs_sc_ovw" },
  { key: "employment", field: "employment", source: "Eurostat sbs_sc_ovw" },
  { key: "turnover", field: "turnoverMeur", source: "Eurostat sbs_sc_ovw" },
  { key: "growth", field: "growthPct", source: "Eurostat sbs_sc_ovw" },
  { key: "aiUse", field: "aiUsePct", source: "Eurostat isoc_eb_ain2" },
  { key: "vacancy", field: "vacancyRatePct", source: "Eurostat jvs_a_rate_r2" },
];

export function buildHubDoc(r: HubResearch, facts: HubFacts | null, locale: Locale): HubDoc {
  const lang = LOCALES[locale].lang;
  const t = (l: { en: string } & Record<string, string>) => l[lang] || l.en;
  const stats = facts
    ? STATS.flatMap(({ key, field, source }) => (field in facts.facts ? [{ key, value: facts.facts[field], period: facts.period, source }] : []))
    : [];
  const hook = r.hook;
  return hubDocSchema.parse({
    kind: "industry-hub",
    v: 1,
    industry: r.industry,
    country: r.country,
    nace: r.nace,
    lang,
    researchedAt: r.researchedAt,
    name: t(r.name),
    tagline: t(r.tagline),
    overview: { text: t(r.overview.text), sources: r.overview.sources },
    stats,
    pains: r.pains.map((p) => ({ text: t(p.text), sources: p.sources })),
    deadlines: [...r.deadlines]
      .sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999"))
      .map((d) => ({ ...d, title: t(d.title), what: t(d.what), offer: t(d.offer) })),
    news: [...r.news].sort((a, b) => b.date.localeCompare(a.date)).map((n) => ({ ...n, title: t(n.title), takeaway: t(n.takeaway) })),
    solutions: r.solutions.map((s) => ({ title: t(s.title), outcome: t(s.outcome) })),
    hook: {
      id: hook.id,
      title: t(hook.title),
      promise: t(hook.promise),
      questions: hook.questions.map((q) => ({ ...q, label: t(q.label), options: q.options.map((o) => ({ tag: o.tag, label: t(o.label) })) })),
      calc: hook.calc && { ...hook.calc, label: t(hook.calc.label), result: t(hook.calc.result) },
    },
    kpi: r.kpi,
  });
}

export type HubDraft = { locale: Locale; slug: string; type: "industry-hub"; title: string; summary: string; body: string };

export function hubDrafts(r: HubResearch, facts: HubFacts | null, now: Date): { drafts: HubDraft[]; issues: HubIssue[] } {
  const checked = checkResearch(r, now);
  if (checked.issues.some((i) => i.level === "error")) return { drafts: [], issues: checked.issues };
  const drafts = HUB_LOCALES.map((locale) => {
    const doc = buildHubDoc(checked.research, facts, locale);
    return { locale, slug: hubSlug(r.industry, r.country), type: "industry-hub" as const, title: doc.name, summary: doc.tagline, body: JSON.stringify(doc, null, 1) };
  });
  return { drafts, issues: checked.issues };
}

/* ───────────── Inputs on disk (research and market-selection runs) ───────────── */

const latestDir = (dir: string) => (existsSync(dir) ? readdirSync(dir).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().at(-1) : undefined);

// Newest research file for every industry × country.
export function loadResearch(root = "data/hubs/research"): HubResearch[] {
  if (!existsSync(root)) return [];
  const latest = new Map<string, HubResearch>();
  for (const day of readdirSync(root).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()) {
    for (const file of readdirSync(path.join(root, day)).filter((f) => /^[a-z0-9-]+-[a-z]{2}\.json$/.test(f))) {
      const r = researchSchema.parse(JSON.parse(readFileSync(path.join(root, day, file), "utf8")));
      latest.set(`${r.industry}-${r.country}`, r);
    }
  }
  return [...latest.values()];
}

/**
 * Facts for the hub's NACE division from the newest market-selection run; falls back to the snapshot the
 * research step saved next to its files, so hubs build before the market-selection branch is merged.
 */
export function loadFacts(r: HubResearch, roots = ["data/market-selection/runs", "data/hubs/facts"]): HubFacts | null {
  const division = r.nace[0].split(".")[0];
  for (const root of roots) {
    const day = latestDir(root);
    const file = day && path.join(root, day, `industry-${r.country}.json`);
    if (!file || !existsSync(file)) continue;
    const run = JSON.parse(readFileSync(file, "utf8")) as { period: string; rows: { id: string; facts: Record<string, unknown>; sources: Record<string, string> }[] };
    const row = run.rows.find((x) => x.id === division);
    if (!row) continue;
    const numbers = Object.fromEntries(Object.entries(row.facts).filter(([, v]) => typeof v === "number"));
    // Only the official statistics behind the numbers; the run's own research notes are not a source for readers.
    const sources = [...new Set(Object.values(row.sources).filter((v) => v.startsWith("Eurostat")).map((v) => v.split(",")[0]))];
    return factsSchema.parse({ facts: numbers, period: run.period, sources });
  }
  return null;
}

/* ───────────── Reading a published hub ───────────── */

export function parseHubDoc(body: string): HubDoc | null {
  try {
    const parsed = hubDocSchema.safeParse(JSON.parse(body));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

// The approved hub page for this locale, or English when this language is not approved yet.
export async function getHubDoc(db: Db, locale: string, industry: string, country: string) {
  const slug = hubSlug(industry, country);
  for (const l of [locale, "en-gb"]) {
    const item = await getPublished(db, l, slug);
    const doc = item && parseHubDoc(item.body);
    if (doc) return { doc, locale: l, publishedAt: item.publishedAt };
  }
  return null;
}

/* ───────────── Cockpit: one row per hub (value filter: KPI next to the hub) ───────────── */

export async function hubStatus(db: Db, now = new Date()) {
  const leads = await leadsThisMonth(db, now);
  return Promise.all(
    loadResearch().map(async (r) => {
      const pages = await db
        .select({ locale: contentItems.locale, status: contentItems.status })
        .from(contentItems)
        .where(and(eq(contentItems.slug, hubSlug(r.industry, r.country)), eq(contentItems.type, "industry-hub")));
      const { issues } = checkResearch(r, now);
      return {
        industry: r.industry,
        country: r.country,
        name: r.name.en,
        researchedAt: r.researchedAt,
        live: pages.filter((p) => p.status === "published").map((p) => p.locale),
        waiting: pages.filter((p) => p.status === "pending").map((p) => p.locale),
        leads: leads.get(`${r.industry}-${r.country}`) ?? 0,
        kpi: r.kpi,
        issues,
      };
    }),
  );
}
