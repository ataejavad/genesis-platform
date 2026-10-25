"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { partnerCopy } from "@/config/partner-copy";
import { PORTAL_LANGS } from "@/config/portal-copy";
import { getDb } from "@/db";
import { requirePartner } from "@/lib/partner-auth";
import { LANG_COOKIE } from "@/lib/portal-auth";
import type { Actor } from "@/server/actor";
import { AppError } from "@/server/errors";
import { type PartnerCard, partnerReply } from "@/server/partner-chat";
import { addDocument, addService, deliver, removeService, respondOffer, sendPartnerMessage, setCapacity, setPartnerLocale } from "@/server/partners";
import { saveTurn, threadMessages } from "@/server/portal";

// Partner portal actions. The partner id always comes from the session, never from the browser.
const actorOf = (userId: string): Actor => ({ type: "user", id: userId });
const refresh = () => revalidatePath("/partner", "layout");

export async function sendMessage(threadId: string | null, text: string) {
  const { user, partner, lang } = await requirePartner();
  const db = getDb();
  const msg = text.trim().slice(0, 2000);
  if (!msg || !partner.orgId) return null;
  const history = threadId ? await threadMessages(db, partner.orgId, user.id, threadId) : null;
  const lastBot = history?.messages.filter((m) => m.role === "assistant").at(-1)?.text;
  const reply = await partnerReply(db, partner.id, lang, msg, lastBot);
  const saved = await saveTurn(db, partner.orgId, user.id, threadId, msg, { text: reply.text, cards: reply.cards });
  return { threadId: saved.threadId, text: reply.text, cards: reply.cards as PartnerCard[] };
}

export async function loadThread(threadId: string) {
  const { user, partner } = await requirePartner();
  if (!partner.orgId) return null;
  const t = await threadMessages(getDb(), partner.orgId, user.id, threadId);
  return t ? t.messages.map((m) => ({ role: m.role as "user" | "assistant", text: m.text, cards: m.cards as PartnerCard[] })) : null;
}

export async function respond(offerId: string, accept: boolean) {
  const { user, partner, lang } = await requirePartner();
  const t = partnerCopy(lang).r;
  try {
    const r = await respondOffer(getDb(), actorOf(user.id), partner.id, offerId, accept);
    refresh();
    return { ok: true, text: r.assigned ? t.accepted : t.declined };
  } catch (err) {
    if (err instanceof AppError) return { ok: false, text: t.taken };
    throw err;
  }
}

export async function deliverWork(jobId: string, link: string, note: string, checks: boolean[]) {
  const { user, partner, lang } = await requirePartner();
  try {
    await deliver(getDb(), actorOf(user.id), partner.id, jobId, { link, note: note || undefined, selfCheck: checks });
    refresh();
    return { ok: true, text: partnerCopy(lang).page.work.delivered };
  } catch (err) {
    if (err instanceof AppError || (err instanceof Error && err.name === "ZodError")) return { ok: false, text: err instanceof AppError ? err.message : "invalid link" };
    throw err;
  }
}

export async function messageTeam(text: string, reviewRequest = false, jobId?: string) {
  const { user, partner, lang } = await requirePartner();
  const m = await sendPartnerMessage(getDb(), actorOf(user.id), partner.id, "partner", text, { reviewRequest, jobId });
  refresh();
  return { ok: true, text: partnerCopy(lang).r.sent, flagged: m.flagged };
}

export async function saveService(f: FormData) {
  const { user, partner } = await requirePartner();
  const s = (k: string) => String(f.get(k) ?? "").trim();
  await addService(getDb(), actorOf(user.id), partner.id, { title: s("title"), skills: f.getAll("skills").map(String), priceModel: s("model") as "fixed", priceEur: Math.round(Number(s("price"))), deliveryDays: Math.round(Number(s("days"))) }).catch((e) => { if (!(e instanceof Error && e.name === "ZodError")) throw e; });
  refresh();
}

export async function dropService(f: FormData) {
  const { user, partner } = await requirePartner();
  await removeService(getDb(), actorOf(user.id), partner.id, String(f.get("id")));
  refresh();
}

export async function saveCapacity(f: FormData) {
  const { user, partner } = await requirePartner();
  await setCapacity(getDb(), actorOf(user.id), partner.id, Number(f.get("capacity") ?? 2), f.get("paused") === "on");
  refresh();
}

export async function saveDocument(f: FormData) {
  const { user, partner } = await requirePartner();
  const exp = String(f.get("expires") ?? "");
  await addDocument(getDb(), actorOf(user.id), partner.id, String(f.get("kind")), String(f.get("link")).trim(), exp ? new Date(exp) : undefined).catch((e) => { if (!(e instanceof Error && e.name === "ZodError")) throw e; });
  refresh();
}

export async function setLanguage(lang: string) {
  const { partner, viewingAs } = await requirePartner();
  if (!(PORTAL_LANGS as readonly string[]).includes(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 365 * 864e2, sameSite: "lax" });
  if (!viewingAs) await setPartnerLocale(getDb(), { type: "user", id: partner.userId ?? partner.id }, partner.id, lang);
  refresh();
}
