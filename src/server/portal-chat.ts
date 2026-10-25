import type { Db } from "@/db";
import { fmtEur, portalCopy } from "@/config/portal-copy";
import { normalize } from "@/lib/chat-match";
import { listGoals, listRequests, listServices, nextStep, pendingApprovals, type RequestKind, results } from "./portal";
import { INPUT_TEXTS } from "@/config/delivery-seeds";
import type { Actor } from "./actor";
import { addInput, customerNeeds, customerProjects, SILENCE } from "./projects";
import { inArray } from "drizzle-orm";
import { milestones } from "@/db/schema";
import { journeyCopy } from "@/config/journey-copy";
import { type Brief, draftBrief } from "./brief";
import { openComplaintFor, type Step } from "./complaints";

/*
 * The dashboard home is a conversation (Javad 2026-10-25: "like Claude: the customer talks, and sees results
 * and what they need right there"). A reply is text plus cards. Cards are only these fixed types and are always
 * filled from the customer's own data on the server (generative UI that composes approved parts, never invents);
 * anything that changes something is a `confirm` card the customer presses. Without a Claude key the intent
 * comes from the multilingual word rules below; with a key Claude picks the intent and cards (portal-advisor.ts).
 */

export const INTENTS = ["complaint", "results", "goals", "approvals", "materials", "projects", "services", "next", "problem", "support", "billing", "data", "requests", "help"] as const;
export type Intent = (typeof INTENTS)[number];

export type Card =
  | { type: "results"; data: Awaited<ReturnType<typeof results>> }
  | { type: "goals"; data: Awaited<ReturnType<typeof listGoals>> }
  | { type: "approvals"; data: { id: string; title: string; detail: string | null; link: string | null; milestone?: boolean; autoOn?: string | null }[] }
  | { type: "brief"; data: Brief }
  | { type: "complaint"; data: { text: string; step: Step | "support"; open: boolean } }
  | { type: "services"; data: Awaited<ReturnType<typeof listServices>> }
  | { type: "projects"; data: Awaited<ReturnType<typeof customerProjects>> }
  | { type: "needs"; data: Awaited<ReturnType<typeof customerNeeds>> }
  | { type: "next"; data: NonNullable<Awaited<ReturnType<typeof nextStep>>> }
  | { type: "requests"; data: { id: string; kind: string; text: string; status: string; reply: string | null; createdAt: string; priceBy?: string | null }[] }
  | { type: "confirm"; kind: RequestKind; text: string }
  | { type: "link"; href: string; label: string };

export type Reply = { text: string; cards: Card[] };

// Order matters: the first rule that matches wins.
const RULES: [Intent, RegExp][] = [
  ["complaint", /non (sono|siamo) soddisf|insoddisf|delus|not (happy|satisfied)|unhappy|disappointed|dissatisf|nicht zufrieden|unzufrieden|enttausch|راضی نیستم|راضی نیستیم|ناراضی/],
  ["support", /non funziona|non va|errore|guasto|broken|not working|doesn.?t work|error|bug|funktioniert nicht|fehler|kaputt|کار نمی.?کن|خراب|خطا/],
  ["approvals", /approv|conferm|aspett|in attesa|waiting|pending|sign.?off|freigab|bestatig|wartet|تا\u0654?یید|منتظر/],
  ["materials", /material|document|allegat|allego|file|cosa vi serve|cosa serve|what do you need|send you|unterlagen|dokument|was brauchen sie|مدارک|فایل|سند|چه چیزی لازم|چی لازم/],
  ["goals", /obiettiv|traguard|goal|target|ziel|هدف/],
  ["projects", /progett|a che punto|avanzament|project|progress|how far|projekt|fortschritt|wie weit|پروژه|پیشرفت|کجای کار/],
  ["next", /prossim|dopo|cosa conviene|next|what should|grow|crescere|nachst|als nachstes|wachsen|قدم بعد|بعدی|رشد|ارتقا|upgrade/],
  ["billing", /fattur|pagament|canone|bolletta|invoice|payment|billing|fee|rechnung|zahlung|gebuhr|فاکتور|پرداخت|هزینه|قرارداد|contratt|contract|vertrag/],
  ["data", /\bdati\b|gdpr|privacy|esport|cancell|\bdata\b|export|delete|datenschutz|daten|losch|داده|حذف|حریم/],
  ["requests", /richiest|ticket|request|anfrage|درخواست/],
  ["services", /serviz|abbonament|service|subscription|leistung|dienst|خدمات|سرویس/],
  ["results", /risultat|recuperat|risparm|quanto|guadagn|result|saved|back this|how much|roi|worth|ergebnis|gespart|zuruck|wie viel|نتیجه|برگشت|صرفه|چقدر|سود|report|rapport|bericht|گزارش/],
  ["problem", /problem|ho bisogno|vorrei|mi serve|perdiamo|perdo|need|we lose|takes too long|costs us|brauche|verlieren|dauert|مشکل|نیاز|لازم|وقت.*می.?گیر|ضرر/],
  ["help", /^(ciao|salve|buongiorno|hi|hello|hey|hallo|guten|سلام|درود)\b|aiut|help|hilfe|کمک|cosa puoi|what can you|was kannst/],
];

export function detectIntent(text: string): Intent {
  const t = normalize(text).replace(/ي/g, "ی");
  return RULES.find(([, re]) => re.test(t))?.[0] ?? "help";
}

/** Builds the reply for an intent from the customer's own data. */
async function briefReply(db: Db, lang: string, text: string): Promise<Reply> {
  const b = await draftBrief(db, lang, text);
  return { text: b.package ? journeyCopy(lang).briefReady : journeyCopy(lang).briefQuote, cards: [{ type: "brief", data: b }] };
}

/** What waits for the customer's OK; a milestone shows the day it counts as accepted if nobody answers. */
export async function approvalCards(db: Db, orgId: string) {
  const a = await pendingApprovals(db, orgId);
  const ms = a.some((x) => x.milestoneId) ? await db.select({ id: milestones.id, readyAt: milestones.readyAt }).from(milestones).where(inArray(milestones.id, a.flatMap((x) => (x.milestoneId ? [x.milestoneId] : [])))) : [];
  return a.map((x) => {
    const r = ms.find((m) => m.id === x.milestoneId)?.readyAt;
    return { id: x.id, title: x.title, detail: x.detail, link: x.link, milestone: Boolean(x.milestoneId), autoOn: r ? new Date(r.getTime() + SILENCE.autoAcceptDays * 864e5).toISOString().slice(0, 10) : null };
  });
}

export async function replyFor(db: Db, orgId: string, lang: string, intent: Intent, userText: string): Promise<Reply> {
  const c = portalCopy(lang).r;
  const j = journeyCopy(lang);
  const p = portalCopy(lang);
  switch (intent) {
    case "results": {
      const r = await results(db, orgId);
      return { text: r.month.eur ? c.results.replace("{eur}", fmtEur(r.month.eur, lang)).replace("{fee}", fmtEur(r.feeEur, lang)) : c.resultsNone, cards: [{ type: "results", data: r }] };
    }
    case "goals": {
      const g = await listGoals(db, orgId, lang);
      return g.length ? { text: c.goals, cards: [{ type: "goals", data: g }] } : { text: c.goalsNone, cards: [{ type: "confirm", kind: "change", text: userText }] };
    }
    case "approvals": {
      const a = await approvalCards(db, orgId);
      return { text: a.length ? c.approvals.replace("{n}", String(a.length)) : c.approvalsNone, cards: a.length ? [{ type: "approvals", data: a }] : [] };
    }
    case "complaint": {
      // the ladder is explained on the card; nothing changes until the customer presses it
      const open = await openComplaintFor(db, orgId);
      const step: Step | "support" = open ? (open.step === "fix" ? "swap" : "founder") : (await customerProjects(db, orgId)).length ? "fix" : "support";
      return { text: j.complaintAsk[step], cards: [{ type: "complaint", data: { text: userText, step, open: Boolean(open) } }] };
    }
    case "projects": {
      const pr = await customerProjects(db, orgId);
      const needs = await customerNeeds(db, orgId, lang);
      return { text: pr.length ? c.projects : c.projectsNone, cards: [...(pr.length ? [{ type: "projects" as const, data: pr }] : []), ...(needs.length ? [{ type: "needs" as const, data: needs }] : [])] };
    }
    case "materials": {
      const needs = await customerNeeds(db, orgId, lang);
      return needs.length ? { text: c.materials, cards: [{ type: "needs", data: needs }] } : { text: c.materialsNone, cards: [] };
    }
    case "services": {
      const s = await listServices(db, orgId, lang);
      return { text: s.length ? c.services : c.servicesNone, cards: s.length ? [{ type: "services", data: s }] : [] };
    }
    case "next": {
      const n = await nextStep(db, orgId, lang);
      return n ? { text: c.next, cards: [{ type: "next", data: n }] } : { text: c.nextNone, cards: [] };
    }
    case "problem":
      // a sentence that already says what is wrong becomes a brief to confirm; "I have a new problem" asks first
      return userText.trim().split(/\s+/).length >= 6 ? briefReply(db, lang, userText) : { text: c.newProblem, cards: [] };
    case "support":
      return { text: c.confirmSupport, cards: [{ type: "confirm", kind: "support", text: userText }] };
    case "billing": {
      const r = await results(db, orgId);
      return { text: c.billing.replace("{fee}", fmtEur(r.feeEur, lang)), cards: [{ type: "link", href: "/portal/billing", label: p.nav.billing }] };
    }
    case "data":
      return { text: c.data, cards: [{ type: "link", href: "/portal/data", label: p.nav.data }] };
    case "requests": {
      const r = (await listRequests(db, orgId)).slice(0, 5);
      return { text: r.length ? c.requests : c.requestsNone, cards: r.length ? [{ type: "requests", data: r.map((x) => ({ id: x.id, kind: x.kind, text: x.text, status: x.status, reply: x.reply, createdAt: x.createdAt.toISOString().slice(0, 10), priceBy: x.status === "open" && x.dueAt && (x.kind === "solution" || x.kind === "change") ? x.dueAt.toISOString() : null })) }] : [] };
    }
    default:
      return { text: c.fallback, cards: [] };
  }
}

/** After "I have a new problem", the next message is the problem itself. */
export const awaitingProblem = (lastBotText: string | undefined, lang: string) => lastBotText === portalCopy(lang).r.newProblem;

export async function scriptedReply(db: Db, orgId: string, lang: string, text: string, lastBotText?: string): Promise<Reply & { intent: Intent }> {
  if (awaitingProblem(lastBotText, lang) && text.trim().length > 3) return { intent: "problem", ...(await briefReply(db, lang, text)) };
  const intent = detectIntent(text);
  return { intent, ...(await replyFor(db, orgId, lang, intent, text)) };
}

/* ───────────── Project material in the conversation (step 7: customer → partner pipe) ───────────── */

const ASK_MARK = "📎 ";

/** The label the last answer asked for («…» in askInput), when it asked for one. */
export function askedLabel(lastBotText: string | undefined, lang: string) {
  if (!lastBotText) return null;
  const tail = portalCopy(lang).r.askInput.split("{label}")[1]?.trim().slice(1, 12);
  if (!tail || !lastBotText.includes(tail)) return null;
  return lastBotText.match(/«(.+?)»/)?.[1] ?? null;
}

/** The customer's words for a need back to the protocol input it answers, with its project. */
async function findNeed(db: Db, orgId: string, lang: string, shown: string | null) {
  const all = await customerNeeds(db, orgId, lang);
  for (const p of all) for (const n of p.needs) if (shown && (n.text === shown || n.label === shown)) return { projectId: p.projectId, label: n.label };
  const canonical = shown ? (Object.entries(INPUT_TEXTS).find(([, t]) => Object.values(t).includes(shown))?.[0] ?? shown) : null;
  const running = (await customerProjects(db, orgId)).find((p) => p.status === "running");
  return running ? { projectId: running.id, label: canonical ?? "Other" } : null;
}

async function nextAsk(db: Db, orgId: string, lang: string, first: string) {
  const c = portalCopy(lang).r;
  const left = (await customerNeeds(db, orgId, lang)).flatMap((p) => p.needs);
  return left.length ? `${first} ${c.askInput.replace("{label}", left[0].text)}` : `${first} ${c.materialsNone}`;
}

/**
 * Material turns come before anything else: "📎 <need>" asks for it; the answer after such a question is saved
 * (identity removed for partners). Returns null when the message is not about material.
 */
export async function materialTurn(db: Db, actor: Actor, orgId: string, lang: string, text: string, lastBotText?: string): Promise<Reply | null> {
  const c = portalCopy(lang).r;
  if (text.startsWith(ASK_MARK)) {
    const shown = text.slice(ASK_MARK.length).trim();
    return { text: c.askInput.replace("{label}", shown), cards: [] };
  }
  const asked = askedLabel(lastBotText, lang);
  if (!asked || text.trim().length < 2) return null;
  const need = await findNeed(db, orgId, lang, asked);
  if (!need) return { text: c.noProject, cards: [] };
  await addInput(db, actor, { projectId: need.projectId, label: need.label, source: "chat", text }, orgId);
  return { text: await nextAsk(db, orgId, lang, c.gotInput), cards: [] };
}

/** A file from the chat's 📎: it answers the open question, else the first thing we still need. */
export async function materialFile(db: Db, actor: Actor, orgId: string, lang: string, file: { name: string; type: string; bytes: Uint8Array }, lastBotText?: string): Promise<Reply> {
  const c = portalCopy(lang).r;
  const asked = askedLabel(lastBotText, lang);
  const first = (await customerNeeds(db, orgId, lang))[0]?.needs[0]?.text ?? null;
  const need = await findNeed(db, orgId, lang, asked ?? first);
  if (!need) return { text: c.noProject, cards: [] };
  const row = await addInput(db, actor, { projectId: need.projectId, label: need.label, source: "file", file }, orgId);
  return { text: await nextAsk(db, orgId, lang, row.status === "check" ? c.fileCheck : c.gotInput), cards: [] };
}
