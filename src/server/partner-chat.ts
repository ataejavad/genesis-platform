import type { Db } from "@/db";
import { partnerCopy } from "@/config/partner-copy";
import { fmtEur } from "@/config/portal-copy";
import { normalize } from "@/lib/chat-match";
import { earnings, levelFor, offersFor, workFor } from "./partners";

/*
 * Partner home is a conversation, on the same pattern as the customer dashboard: text plus fixed card types
 * filled from the partner's own data; anything that changes something is a button the partner presses.
 */

export const PARTNER_INTENTS = ["next", "offers", "earnings", "level", "help", "fallback"] as const;
export type PartnerIntent = (typeof PARTNER_INTENTS)[number];

export type OfferCardData = { id: string; title: string; brief: string; kind: string; customerCode: string | null; payEur: number; dueAt: string; fit: number; why: { factor: string; points: number; max: number }[]; checklist: string[] };
export type PartnerCard =
  | { type: "offers"; data: OfferCardData[] }
  | { type: "next"; data: { id: string; title: string; dueAt: string; status: string } }
  | { type: "earnings"; data: Awaited<ReturnType<typeof earnings>> }
  | { type: "level"; data: Awaited<ReturnType<typeof levelFor>> }
  | { type: "confirm"; text: string };

const RULES: [PartnerIntent, RegExp][] = [
  ["help", /aiuto|problema|team|persona|revision|help|problem|review|human|hilfe|mensch|prufung|کمک|مشکل|تیم|بازبینی|انسان/],
  ["offers", /offert|propost|offer|new job|angebot|neue jobs|پیشنهاد/],
  ["earnings", /guadagn|pagament|soldi|earn|paid|payment|money|verdien|zahlung|geld|درآمد|پرداخت|پول/],
  ["level", /livell|rank|level|tier|stufe|سطح|رتبه/],
  ["next", /adesso|dopo|prossim|scadenz|next|deadline|due|todo|nachst|frist|بعدی|مهلت|کار من/],
];

export function detectPartnerIntent(text: string): PartnerIntent {
  const t = normalize(text);
  return RULES.find(([, re]) => re.test(t))?.[0] ?? "fallback";
}

export async function offerCards(db: Db, partnerId: string): Promise<OfferCardData[]> {
  return (await offersFor(db, partnerId)).map(({ offer, job }) => ({ id: offer.id, title: job.title, brief: job.brief, kind: job.kind, customerCode: job.customerCode, payEur: job.payEur, dueAt: job.dueAt.toISOString().slice(0, 10), fit: offer.fit, why: offer.why, checklist: job.checklist }));
}

export async function partnerReply(db: Db, partnerId: string, lang: string, text: string, lastBotText?: string): Promise<{ intent: PartnerIntent; text: string; cards: PartnerCard[] }> {
  const t = partnerCopy(lang);
  // after "tell me what you need", the next message is the request itself
  if (lastBotText === t.r.help && text.trim().length > 3) return { intent: "help", text: t.r.confirmHelp, cards: [{ type: "confirm", text }] };
  const intent = detectPartnerIntent(text);
  switch (intent) {
    case "offers": {
      const o = await offerCards(db, partnerId);
      return { intent, text: o.length ? t.r.offers.replace("{n}", String(o.length)) : t.r.offersNone, cards: o.length ? [{ type: "offers", data: o }] : [] };
    }
    case "next": {
      const w = (await workFor(db, partnerId)).filter((x) => x.job.status === "assigned");
      const j = w[0]?.job;
      return j ? { intent, text: t.r.next, cards: [{ type: "next", data: { id: j.id, title: j.title, dueAt: j.dueAt.toISOString().slice(0, 10), status: j.status } }] } : { intent, text: t.r.nextNone, cards: [] };
    }
    case "earnings": {
      const e = await earnings(db, partnerId);
      return { intent, text: t.r.earnings.replace("{month}", fmtEur(e.monthEur, lang)).replace("{due}", fmtEur(e.dueEur, lang)), cards: [{ type: "earnings", data: e }] };
    }
    case "level": {
      const l = await levelFor(db, partnerId);
      return { intent, text: l.next ? t.r.level.replace("{tier}", t.tiers[l.tier.id]).replace("{days}", String(l.tier.payoutDays)) : t.r.levelTop, cards: [{ type: "level", data: l }] };
    }
    case "help":
      return text.trim().split(/\s+/).length >= 6 ? { intent, text: t.r.confirmHelp, cards: [{ type: "confirm", text }] } : { intent, text: t.r.help, cards: [] };
    default:
      return { intent, text: t.r.fallback, cards: [] };
  }
}
