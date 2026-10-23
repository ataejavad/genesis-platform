import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Db, DbOrTx } from "@/db";
import { companyPages, prospects } from "@/db/schema";
import type { Actor } from "./actor";
import { type Answers, type Report, computeReport, loadCheckupDef } from "./checkup";
import { audit, emit } from "./events";
import { type PageDoc, pageDocSchema, type researchedPage } from "./company-page-doc";
import { loadResearch } from "./hubs";
import { planWarmCall } from "./outreach";

/*
 * One page per company, made before the first contact (research 2026-10-23; Javad: "find the customer's data
 * before we approach, give them the full page and a first persona they can interact with and like"). It holds:
 *  - what we found about the firm, each fact with its public source;
 *  - an estimated check-up (same engine and rules as the public one, every input marked as an estimate);
 *  - a free starter persona of the company (doc 00 principle 45), which the visitor can correct in the chat.
 * The company-research agent writes the facts and persona with Claude when a key is set; without it the page
 * is built from the Maps data and the hub research. Links in messages point here instead of the bare check-up.
 */

type ProspectRow = typeof prospects.$inferSelect;

const teamOf = (staff: number | null) => (staff === null ? "m" : staff < 10 ? "s" : staff < 20 ? "m" : staff < 50 ? "l" : "xl");
const MIDDLE: Record<string, string> = { low: "mid", always: "sometimes", none: "some" };

/** Check-up answers estimated from what we know: size from staff, work from signals, the middle option elsewhere. */
export function estimateAnswers(p: Pick<ProspectRow, "industry" | "staff" | "signals">): Answers | null {
  const def = loadCheckupDef(p.industry);
  if (!def) return null;
  const a: Answers = {};
  for (const q of def.questions) {
    const ids = q.options.map((o) => o.id);
    if (q.id === "team") a.team = teamOf(p.staff);
    else if (q.multi) a[q.id] = Array.isArray(p.signals.affectedByObligation) && ids.includes("import") && p.industry === "metal" ? ["import"] : [ids[0]];
    else a[q.id] = ids.find((id) => id === "mid") ?? MIDDLE[ids[0]] ?? ids[Math.floor(ids.length / 2)];
  }
  return a;
}

export function templatePersona(p: ProspectRow, lang: string): PageDoc["persona"] {
  const r = loadResearch().find((x) => x.industry === p.industry && x.country === p.country);
  const t = (v: unknown) => ((v as Record<string, string>)[lang] ?? (v as Record<string, string>).en ?? "") as string;
  const name = r ? t(r.name) : p.industry;
  const S: Record<string, { summary: string; questions: string[] }> = {
    it: {
      summary: `${p.name} è un'impresa del settore ${name.toLowerCase()}${p.city ? ` con sede a ${p.city}` : ""}. Questo è un primo profilo costruito da fonti pubbliche: correggetelo nella chat e diventerà il vostro assistente aziendale.`,
      questions: ["Quanti preventivi fate a settimana?", "Chi risponde al telefono quando siete in cantiere o in officina?", "Quale lavoro vorreste fare di più?"],
    },
    en: {
      summary: `${p.name} is a ${name.toLowerCase()} firm${p.city ? ` based in ${p.city}` : ""}. This is a first profile built from public sources: correct it in the chat and it becomes your company assistant.`,
      questions: ["How many quotes do you send a week?", "Who answers the phone when you are on site?", "Which work would you like more of?"],
    },
  };
  const s = S[lang] ?? S.en;
  return {
    summary: s.summary,
    offers: [],
    customers: null,
    // hub pains read "headline: detail"; the detail is the why
    pains: (r?.pains ?? []).slice(0, 3).map((x) => {
      const [head, ...rest] = t(x.text).split(":");
      return { text: head.trim().slice(0, 200), why: rest.join(":").trim().slice(0, 300) };
    }),
    questions: s.questions,
  };
}

export function mapsFacts(p: ProspectRow, lang: string): PageDoc["facts"] {
  const out: PageDoc["facts"] = [];
  const s = p.signals as { mapsUrl?: string; rating?: number; reviews?: number; category?: string };
  if (s.mapsUrl && s.category) out.push({ text: lang === "it" ? `Categoria su Google Maps: ${s.category}` : `Google Maps category: ${s.category}`, source: { name: "Google Maps", url: s.mapsUrl } });
  if (s.mapsUrl && s.rating) out.push({ text: lang === "it" ? `Valutazione ${s.rating}/5 su ${s.reviews ?? "?"} recensioni` : `Rated ${s.rating}/5 from ${s.reviews ?? "?"} reviews`, source: { name: "Google Maps", url: s.mapsUrl } });
  if (p.website) out.push({ text: lang === "it" ? "Sito web aziendale" : "Company website", source: { name: p.website.replace(/^https?:\/\//, ""), url: p.website.includes("://") ? p.website : `https://${p.website}` } });
  return out;
}

export function buildPageDoc(p: ProspectRow, lang: string, locale: string, researched?: z.infer<typeof researchedPage>, now = new Date()): PageDoc | null {
  const answers = estimateAnswers(p);
  const def = loadCheckupDef(p.industry);
  if (!answers || !def) return null;
  const report: Report = computeReport(def, answers, { country: p.country, lang, locale, now });
  return {
    company: p.name,
    city: p.city,
    facts: researched?.facts ?? mapsFacts(p, lang),
    persona: researched?.persona ?? templatePersona(p, lang),
    estimate: { answers, report: report as unknown as Record<string, unknown> },
    preparedAt: now.toISOString().slice(0, 10),
    by: researched ? "agent" : "template",
  };
}

export async function createPage(tx: DbOrTx, p: ProspectRow, locale: string, researched?: z.infer<typeof researchedPage>, now = new Date()) {
  const doc = buildPageDoc(p, locale.slice(0, 2), locale, researched, now);
  if (!doc) return null;
  const code = randomBytes(8).toString("base64url").replace(/[-_]/g, "x").slice(0, 10);
  const [row] = await tx.insert(companyPages).values({ prospectId: p.id, code, locale, doc }).onConflictDoNothing().returning();
  return row ?? null;
}

export const pageUrl = (appUrl: string, page: { locale: string; code: string }) => `${appUrl}/${page.locale}/for/${page.code}`;

export async function setPageStatus(tx: DbOrTx, prospectId: string, status: "live" | "archived") {
  await tx.update(companyPages).set({ status }).where(eq(companyPages.prospectId, prospectId));
}

export async function getLivePage(db: Db, code: string) {
  if (!/^[\w]{6,20}$/.test(code)) return null;
  const [row] = await db.select().from(companyPages).where(eq(companyPages.code, code));
  if (!row || row.status !== "live") return null;
  return { ...row, doc: pageDocSchema.parse(row.doc) };
}

export async function getPageFor(db: Db, prospectId: string) {
  const [row] = await db.select().from(companyPages).where(eq(companyPages.prospectId, prospectId));
  return row ?? null;
}

/** A visit is the strongest intent signal we get: first view alerts Javad (speed to lead) and lifts the company. */
export async function recordView(db: Db, code: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(companyPages)
      .set({ views: sql`${companyPages.views} + 1`, lastViewedAt: now, firstViewedAt: sql`coalesce(${companyPages.firstViewedAt}, ${now.toISOString()}::timestamptz)` })
      .where(eq(companyPages.code, code))
      .returning();
    if (!row) return null;
    await tx
      .update(prospects)
      .set({ signals: sql`${prospects.signals} || ${JSON.stringify({ pageViews: row.views, seenAt: now.toISOString().slice(0, 10) })}::jsonb` })
      .where(eq(prospects.id, row.prospectId));
    if (row.views === 1) {
      const actor: Actor = { type: "system", id: "company-page" };
      const [p] = await tx.select({ industry: prospects.industry, name: prospects.name }).from(prospects).where(eq(prospects.id, row.prospectId));
      await planWarmCall(tx, row.prospectId, now);
      await emit(tx, actor, "company_page.viewed", { type: "prospect", id: row.prospectId }, { industry: p.industry, company: p.name });
      await audit(tx, actor, "company_page.viewed", { type: "prospect", id: row.prospectId }, null, { views: 1 });
    }
    return row.views;
  });
}
