import type { Db } from "@/db";
import { partnerAdvisorEnabled, partnerAdvisorTurn } from "@/agents/partner-advisor";
import { partnerCopy } from "@/config/partner-copy";
import { fmtEur } from "@/config/portal-copy";
import { normalize } from "@/lib/chat-match";
import { documentsFor, earnings, getPartner, levelFor, messagesFor, offersFor, type TodayItem, todayFor, workFor } from "./partners";

/*
 * Partner home is a conversation, on the same pattern as the customer dashboard: text plus fixed card types
 * filled from the partner's own data; anything that changes something is a button the partner presses.
 * Javad 2026-10-25: the partner should get everything here (today's priorities, a project's brief and
 * checklist, offers, pay, documents, messages from us) without hunting through the pages.
 */

export const PARTNER_INTENTS = ["today", "job", "offers", "earnings", "level", "messages", "docs", "rules", "help", "fallback"] as const;
export type PartnerIntent = (typeof PARTNER_INTENTS)[number];

export type OfferCardData = { id: string; title: string; brief: string; kind: string; customerCode: string | null; payEur: number; dueAt: string; fit: number; why: { factor: string; points: number; max: number }[]; checklist: string[] };
export type JobCardData = { id: string; title: string; customerCode: string | null; status: string; dueAt: string; payEur: number; brief: string; checklist: string[]; review: string | null; lastStatus: string | null; materials?: string[] };
export type PartnerCard =
  | { type: "today"; data: TodayItem[] }
  | { type: "job"; data: JobCardData }
  | { type: "offers"; data: OfferCardData[] }
  // kept for conversations saved before "today" replaced it
  | { type: "next"; data: { id: string; title: string; dueAt: string; status: string } }
  | { type: "earnings"; data: Awaited<ReturnType<typeof earnings>> }
  | { type: "level"; data: Awaited<ReturnType<typeof levelFor>> }
  | { type: "messages"; data: { at: string; text: string }[] }
  | { type: "docs"; data: { kind: string; status: string; expiresAt: string | null; expiring: boolean }[] }
  | { type: "rules"; data: string[] }
  | { type: "confirm"; text: string };

// Order matters: the first rule that matches wins.
const RULES: [PartnerIntent, RegExp][] = [
  ["help", /aiuto|problema|parlare con|revision|help|problem|review|human|hilfe|mensch|prufung|کمک|مشکل|بازبینی|انسان/],
  ["offers", /offert|propost|offer|new job|angebot|neue jobs|پیشنهاد/],
  ["earnings", /guadagn|pagament|pagat|soldi|fattur|earn|paid|pay|money|invoice|verdien|zahlung|geld|rechnung|درآمد|پرداخت|پول|فاکتور/],
  ["level", /livell|rank|level|tier|stufe|سطح|رتبه/],
  ["today", /oggi|adesso|priorit|cosa devo|scadenz|today|\bnow\b|what.*\b(do|next)\b|deadline|\bdue\b (today|date)|to.?do|heute|jetzt|frist|was steht|امروز|اولویت|مهلت|کار بعدی|چه کار/],
  ["messages", /messagg|scritt|detto il team|message|wrote|writ|said|nachricht|geschrieben|پیام|نوشت/],
  ["docs", /document|dpa|assicuraz|partita iva|contratt|insurance|vat|contract|dokument|versicherung|avv|vertrag|مدرک|مدارک|بیمه|قرارداد/],
  ["rules", /come funziona|regole|how (does|do) (it|this) work|rules|wie funktioniert|regeln|چطور کار|قوانین|روش کار/],
  ["job", /progett|lavoro|brief|descrizion|checklist|project|job|task|projekt|auftrag|beschreibung|پروژه|شرح|چک.?لیست|کارم/],
];

export function detectPartnerIntent(text: string): PartnerIntent {
  const t = normalize(text);
  return RULES.find(([, re]) => re.test(t))?.[0] ?? "fallback";
}

export async function offerCards(db: Db, partnerId: string): Promise<OfferCardData[]> {
  return (await offersFor(db, partnerId)).map(({ offer, job }) => ({ id: offer.id, title: job.title, brief: job.brief, kind: job.kind, customerCode: job.customerCode, payEur: job.payEur, dueAt: job.dueAt.toISOString().slice(0, 10), fit: offer.fit, why: offer.why, checklist: job.checklist }));
}

/** The project the partner means: the one whose title shares most words with the question, else the most urgent active one. */
export async function jobCard(db: Db, partnerId: string, text: string): Promise<JobCardData | null> {
  const work = await workFor(db, partnerId);
  if (!work.length) return null;
  const words = new Set(normalize(text).split(/[^\p{L}\d]+/u).filter((w) => w.length > 3));
  const score = (title: string) => normalize(title).split(/[^\p{L}\d]+/u).filter((w) => words.has(w)).length;
  const active = (s: string) => (s === "assigned" ? 0 : s === "delivered" ? 1 : 2);
  const best = [...work].sort((a, b) => score(b.job.title) - score(a.job.title) || active(a.job.status) - active(b.job.status) || a.job.dueAt.getTime() - b.job.dueAt.getTime())[0];
  const { job, last, materials } = best;
  return { id: job.id, title: job.title, customerCode: job.customerCode, status: job.status, dueAt: job.dueAt.toISOString().slice(0, 10), payEur: job.payEur, brief: job.brief, checklist: job.checklist, review: last?.review ?? null, lastStatus: last?.status ?? null, materials: materials.map((m) => m.label) };
}

type Reply = { intent: PartnerIntent; text: string; cards: PartnerCard[] };

/** Cards and a scripted sentence for one intent, always from the partner's own data. */
async function answer(db: Db, partnerId: string, lang: string, intent: PartnerIntent, text: string): Promise<Reply> {
  const t = partnerCopy(lang);
  switch (intent) {
    case "today": {
      const items = await todayFor(db, partnerId);
      return { intent, text: items.length ? t.today.reply : t.today.replyEmpty, cards: items.length ? [{ type: "today", data: items }] : [] };
    }
    case "job": {
      // a question about a job still on offer gets the offer card (brief, checklist, accept)
      const words = new Set(normalize(text).split(/[^\p{L}\d]+/u).filter((w) => w.length > 3));
      const offer = (await offerCards(db, partnerId)).find((o) => normalize(o.title).split(/[^\p{L}\d]+/u).some((w) => words.has(w)));
      const j = await jobCard(db, partnerId, text);
      if (offer && !(j && normalize(j.title).split(/[^\p{L}\d]+/u).some((w) => words.has(w)))) return { intent: "offers", text: t.r.offers.replace("{n}", "1"), cards: [{ type: "offers", data: [offer] }] };
      return j ? { intent, text: t.today.job, cards: [{ type: "job", data: j }] } : { intent, text: t.today.jobNone, cards: [] };
    }
    case "offers": {
      const o = await offerCards(db, partnerId);
      return { intent, text: o.length ? t.r.offers.replace("{n}", String(o.length)) : t.r.offersNone, cards: o.length ? [{ type: "offers", data: o }] : [] };
    }
    case "earnings": {
      const e = await earnings(db, partnerId);
      return { intent, text: t.r.earnings.replace("{month}", fmtEur(e.monthEur, lang)).replace("{due}", fmtEur(e.dueEur, lang)), cards: [{ type: "earnings", data: e }] };
    }
    case "level": {
      const l = await levelFor(db, partnerId);
      return { intent, text: l.next ? t.r.level.replace("{tier}", t.tiers[l.tier.id]).replace("{days}", String(l.tier.payoutDays)) : t.r.levelTop, cards: [{ type: "level", data: l }] };
    }
    case "messages": {
      const m = (await messagesFor(db, partnerId)).filter((x) => x.author === "us").slice(-3).reverse();
      return m.length ? { intent, text: t.today.messages, cards: [{ type: "messages", data: m.map((x) => ({ at: x.createdAt.toISOString().slice(0, 10), text: x.shown })) }] } : { intent, text: t.today.messagesNone, cards: [] };
    }
    case "docs": {
      const d = await documentsFor(db, partnerId);
      return d.length ? { intent, text: t.today.docs, cards: [{ type: "docs", data: d.map((x) => ({ kind: x.kind, status: x.status, expiresAt: x.expiresAt?.toISOString().slice(0, 10) ?? null, expiring: x.expiring })) }] } : { intent, text: t.today.docsNone, cards: [] };
    }
    case "rules":
      return { intent, text: t.today.rules, cards: [{ type: "rules", data: t.apply.why }] };
    case "help":
      return text.trim().split(/\s+/).length >= 6 ? { intent, text: t.r.confirmHelp, cards: [{ type: "confirm", text }] } : { intent, text: t.r.help, cards: [] };
    default:
      return { intent, text: t.r.fallback, cards: [] };
  }
}

/** Everything the assistant may know about this partner, for Claude (numbers only from here). */
async function context(db: Db, partnerId: string) {
  const [p, today, work, offers, pay, level, msgs, docs] = await Promise.all([getPartner(db, partnerId), todayFor(db, partnerId), workFor(db, partnerId), offerCards(db, partnerId), earnings(db, partnerId), levelFor(db, partnerId), messagesFor(db, partnerId), documentsFor(db, partnerId)]);
  return {
    partner: { name: p.name, skills: p.skills, capacity: p.capacity, status: p.status },
    today,
    work: work.map(({ job, last }) => ({ title: job.title, customer: job.customerCode, status: job.status, due: job.dueAt.toISOString().slice(0, 10), payEur: job.payEur, brief: job.brief, checklist: job.checklist, lastDelivery: last && { version: last.version, status: last.status, review: last.review } })),
    offers: offers.map((o) => ({ title: o.title, payEur: o.payEur, due: o.dueAt, fit: o.fit })),
    earnings: { monthEur: pay.monthEur, dueEur: pay.dueEur, paidEur: pay.paidEur, payouts: pay.rows.slice(0, 10) },
    level: { tier: level.tier.id, payoutDays: level.tier.payoutDays, stats: level.stats, next: level.next?.id ?? null, missing: level.missing },
    messagesFromTeam: msgs.filter((m) => m.author === "us").slice(-5).map((m) => ({ at: m.createdAt.toISOString().slice(0, 10), text: m.shown })),
    documents: docs.map((d) => ({ kind: d.kind, status: d.status, expires: d.expiresAt?.toISOString().slice(0, 10) ?? null })),
    howItWorks: partnerCopy("en").apply.why,
  };
}

export async function partnerReply(db: Db, partnerId: string, lang: string, text: string, lastBotText?: string, transcript: { role: "user" | "assistant"; text: string }[] = []): Promise<Reply> {
  const t = partnerCopy(lang);
  // after "tell me what you need", the next message is the request itself
  if (lastBotText === t.r.help && text.trim().length > 3) return { intent: "help", text: t.r.confirmHelp, cards: [{ type: "confirm", text }] };
  if (partnerAdvisorEnabled()) {
    try {
      const turn = await partnerAdvisorTurn({ lang, context: await context(db, partnerId), transcript: [...transcript, { role: "user", text }] });
      const base = await answer(db, partnerId, lang, turn.intent, turn.request ?? text);
      return { ...base, text: turn.reply, cards: turn.intent === "help" && turn.request ? [{ type: "confirm", text: turn.request }] : base.cards };
    } catch (err) {
      console.error("partner advisor failed; using word rules", err);
    }
  }
  return answer(db, partnerId, lang, detectPartnerIntent(text), text);
}
