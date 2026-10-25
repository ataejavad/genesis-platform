"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { advisorEnabled, advisorTurn } from "@/agents/portal-advisor";
import { PORTAL_LANGS, portalCopy } from "@/config/portal-copy";
import { getDb } from "@/db";
import { LANG_COOKIE, requireCustomer } from "@/lib/portal-auth";
import type { Actor } from "@/server/actor";
import { runAgent } from "@/server/agents";
import { createRequest, decideCustomerApproval, listGoals, nextStep, pendingApprovals, REQUEST_KINDS, type RequestKind, results, saveTurn, setOrgLocale, threadMessages } from "@/server/portal";
import { createOrder } from "@/server/projects";
import { journeyCopy } from "@/config/journey-copy";
import { draftBrief } from "@/server/brief";
import { complain } from "@/server/complaints";
import { type Card, materialFile, materialTurn, replyFor, scriptedReply } from "@/server/portal-chat";

const actorOf = (userId: string): Actor => ({ type: "user", id: userId });

/** One turn of the home conversation: answer, cards from the customer's data, saved to their history. */
export async function sendMessage(threadId: string | null, text: string) {
  const { user, org, lang, viewingAs } = await requireCustomer();
  const db = getDb();
  const msg = text.trim().slice(0, 2000);
  if (!msg) return null;
  const history = threadId ? await threadMessages(db, org.id, user.id, threadId) : null;
  const past = (history?.messages ?? []).map((m) => ({ role: m.role as "user" | "assistant", text: m.text }));
  const lastBot = past.filter((m) => m.role === "assistant").at(-1)?.text;
  // project material first: an answer to "please write X here" is saved for the team, identity removed
  let reply: { text: string; cards: Card[] } | null = viewingAs ? null : await materialTurn(db, actorOf(user.id), org.id, lang, msg, lastBot);
  if (!reply && advisorEnabled()) {
    try {
      const r = await results(db, org.id);
      const context = { company: org.name, monthEur: r.month.eur, lastMonthEur: r.lastMonth.eur, feeEur: r.feeEur, baselineEur: r.baselineEur, sinceStartEur: r.sinceStart.eur, goals: await listGoals(db, org.id, lang), waitingForYou: (await pendingApprovals(db, org.id)).map((a) => a.title), next: await nextStep(db, org.id, lang) };
      const t = await runAgent(db, "portal-advisor", "chat", () => advisorTurn({ lang, company: org.name, context, transcript: [...past, { role: "user", text: msg }] }), { orgId: org.id });
      const built = await replyFor(db, org.id, lang, t.intent, t.request ?? msg);
      // Claude's sentence, the server's cards (a request card only when Claude extracted a clear request)
      reply = { text: t.reply, cards: (t.intent === "problem" || t.intent === "support") && !t.request ? [] : built.cards };
    } catch {
      reply = null;
    }
  }
  reply ??= await scriptedReply(db, org.id, lang, msg, lastBot);
  const saved = await saveTurn(db, org.id, user.id, threadId, msg, { text: reply.text, cards: reply.cards });
  revalidatePath("/portal");
  return { threadId: saved.threadId, text: reply.text, cards: reply.cards };
}

/** A file from the chat's 📎 (project material): saved, cleaned or held for a check, and answered in the conversation. */
export async function sendFile(threadId: string | null, form: FormData) {
  const { user, org, lang, viewingAs } = await requireCustomer();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || viewingAs) return null;
  const db = getDb();
  const history = threadId ? await threadMessages(db, org.id, user.id, threadId) : null;
  const lastBot = history?.messages.filter((m) => m.role === "assistant").at(-1)?.text;
  let reply: { text: string; cards: Card[] };
  try {
    reply = await materialFile(db, actorOf(user.id), org.id, lang, { name: file.name.slice(0, 200), type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) }, lastBot);
  } catch {
    reply = { text: portalCopy(lang).r.fileBad, cards: [] };
  }
  const saved = await saveTurn(db, org.id, user.id, threadId, `📎 ${file.name}`, reply);
  revalidatePath("/portal");
  return { threadId: saved.threadId, text: reply.text, cards: reply.cards };
}

export async function loadThread(threadId: string) {
  const { user, org } = await requireCustomer();
  const t = await threadMessages(getDb(), org.id, user.id, threadId);
  return t ? t.messages.map((m) => ({ role: m.role as "user" | "assistant", text: m.text, cards: m.cards as Card[] })) : null;
}

/** The customer pressed "send to team" on a confirm card, or used the request form. */
export async function sendRequest(kind: string, text: string) {
  const { user, org, lang } = await requireCustomer();
  if (!(REQUEST_KINDS as readonly string[]).includes(kind)) return { ok: false };
  await createRequest(getDb(), actorOf(user.id), org.id, user.id, kind as RequestKind, text);
  revalidatePath("/portal", "layout");
  return { ok: true, text: portalCopy(lang).r.sent };
}

/** The customer starts a catalogue result with one press: an order the team turns into a project (step 7). */
export async function orderPackage(slug: string) {
  const { user, org, lang } = await requireCustomer();
  await createOrder(getDb(), actorOf(user.id), { packageSlug: slug, source: "portal", orgId: org.id, locale: lang });
  revalidatePath("/portal", "layout");
  return { ok: true, text: portalCopy(lang).card.ordered };
}

export async function decide(id: string, decision: "approved" | "changes", note?: string, stars?: number, ratingNote?: string) {
  const { user, org, lang } = await requireCustomer();
  const rating = decision === "approved" && stars && stars >= 1 && stars <= 5 ? { stars, note: ratingNote?.slice(0, 500) } : undefined;
  await decideCustomerApproval(getDb(), actorOf(user.id), org.id, id, decision === "approved" ? "approved" : "changes", note?.slice(0, 2000), rating);
  revalidatePath("/portal", "layout");
  return { ok: true, text: decision === "approved" ? portalCopy(lang).r.approved : portalCopy(lang).r.changes };
}

const when = (iso: string, lang: string) => new Intl.DateTimeFormat({ it: "it-IT", de: "de-DE", fa: "fa-IR" }[lang] ?? "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Rome" }).format(new Date(iso));

/** The customer confirmed the brief card: a catalogue result is ordered at once, anything else is priced within 24 hours. */
export async function confirmBrief(problem: string) {
  const { user, org, lang, viewingAs } = await requireCustomer();
  if (viewingAs) return { ok: false, text: "" };
  const db = getDb();
  // the package is matched again on the server from the customer's words, never taken from the browser
  const b = await draftBrief(db, lang, problem);
  const j = journeyCopy(lang).brief;
  if (b.package) {
    await createOrder(db, actorOf(user.id), { packageSlug: b.package.slug, source: "portal", orgId: org.id, locale: lang, note: b.problem });
    revalidatePath("/portal", "layout");
    return { ok: true, text: j.ordered };
  }
  const r = await createRequest(db, actorOf(user.id), org.id, user.id, "solution", b.problem, b);
  revalidatePath("/portal", "layout");
  return { ok: true, text: j.requested.replace("{d}", when(r.dueAt!.toISOString(), lang)) };
}

/** "Not satisfied": the next step of the complaint path (free fix → someone new → founder). */
export async function complainNow(text: string) {
  const { user, org, lang, viewingAs } = await requireCustomer();
  if (viewingAs) return { ok: false, text: "" };
  const r = await complain(getDb(), actorOf(user.id), org.id, user.id, text);
  revalidatePath("/portal", "layout");
  return { ok: true, text: journeyCopy(lang).complaintDone[r.step].replace("{d}", when(r.dueAt.toISOString(), lang)) };
}

export async function setLanguage(lang: string) {
  const { user, org, viewingAs } = await requireCustomer();
  if (!(PORTAL_LANGS as readonly string[]).includes(lang)) return;
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 365 * 864e2, sameSite: "lax" });
  // the company's language also drives its reports and messages; an admin view only changes the cookie
  if (!viewingAs) await setOrgLocale(getDb(), actorOf(user.id), org.id, lang);
  revalidatePath("/portal", "layout");
}
