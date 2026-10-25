import type { Db } from "@/db";
import { fmtEur, portalCopy } from "@/config/portal-copy";
import { normalize } from "@/lib/chat-match";
import { listGoals, listRequests, listServices, nextStep, pendingApprovals, type RequestKind, results } from "./portal";

/*
 * The dashboard home is a conversation (Javad 2026-10-25: "like Claude: the customer talks, and sees results
 * and what they need right there"). A reply is text plus cards. Cards are only these fixed types and are always
 * filled from the customer's own data on the server (generative UI that composes approved parts, never invents);
 * anything that changes something is a `confirm` card the customer presses. Without a Claude key the intent
 * comes from the multilingual word rules below; with a key Claude picks the intent and cards (portal-advisor.ts).
 */

export const INTENTS = ["results", "goals", "approvals", "services", "next", "problem", "support", "billing", "data", "requests", "help"] as const;
export type Intent = (typeof INTENTS)[number];

export type Card =
  | { type: "results"; data: Awaited<ReturnType<typeof results>> }
  | { type: "goals"; data: Awaited<ReturnType<typeof listGoals>> }
  | { type: "approvals"; data: { id: string; title: string; detail: string | null; link: string | null }[] }
  | { type: "services"; data: Awaited<ReturnType<typeof listServices>> }
  | { type: "next"; data: NonNullable<Awaited<ReturnType<typeof nextStep>>> }
  | { type: "requests"; data: { id: string; kind: string; text: string; status: string; reply: string | null; createdAt: string }[] }
  | { type: "confirm"; kind: RequestKind; text: string }
  | { type: "link"; href: string; label: string };

export type Reply = { text: string; cards: Card[] };

// Order matters: the first rule that matches wins.
const RULES: [Intent, RegExp][] = [
  ["support", /non funziona|non va|errore|guasto|broken|not working|doesn.?t work|error|bug|funktioniert nicht|fehler|kaputt|کار نمی.?کن|خراب|خطا/],
  ["approvals", /approv|conferm|aspett|in attesa|waiting|pending|sign.?off|freigab|bestatig|wartet|تا\u0654?یید|منتظر/],
  ["goals", /obiettiv|traguard|goal|target|ziel|هدف/],
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
export async function replyFor(db: Db, orgId: string, lang: string, intent: Intent, userText: string): Promise<Reply> {
  const c = portalCopy(lang).r;
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
      const a = await pendingApprovals(db, orgId);
      return { text: a.length ? c.approvals.replace("{n}", String(a.length)) : c.approvalsNone, cards: a.length ? [{ type: "approvals", data: a.map((x) => ({ id: x.id, title: x.title, detail: x.detail, link: x.link })) }] : [] };
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
      // a sentence that already says what is wrong goes straight to a confirm card; "I have a new problem" asks first
      return userText.trim().split(/\s+/).length >= 6 ? { text: c.confirmSolution, cards: [{ type: "confirm", kind: "solution", text: userText }] } : { text: c.newProblem, cards: [] };
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
      return { text: r.length ? c.requests : c.requestsNone, cards: r.length ? [{ type: "requests", data: r.map((x) => ({ id: x.id, kind: x.kind, text: x.text, status: x.status, reply: x.reply, createdAt: x.createdAt.toISOString().slice(0, 10) })) }] : [] };
    }
    default:
      return { text: c.fallback, cards: [] };
  }
}

/** After "I have a new problem", the next message is the problem itself. */
export const awaitingProblem = (lastBotText: string | undefined, lang: string) => lastBotText === portalCopy(lang).r.newProblem;

export async function scriptedReply(db: Db, orgId: string, lang: string, text: string, lastBotText?: string): Promise<Reply & { intent: Intent }> {
  if (awaitingProblem(lastBotText, lang) && text.trim().length > 3) {
    return { intent: "problem", text: portalCopy(lang).r.confirmSolution, cards: [{ type: "confirm", kind: "solution", text }] };
  }
  const intent = detectIntent(text);
  return { intent, ...(await replyFor(db, orgId, lang, intent, text)) };
}
