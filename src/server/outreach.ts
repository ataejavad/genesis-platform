import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import type { Db, DbOrTx } from "@/db";
import { channelSwitches, companyPages, contacts, prospects, touches } from "@/db/schema";
import type { Actor } from "./actor";
import { setPageStatus } from "./company-pages";
import { moveStage, planEnv, unsubscribeLead } from "./crm";
import { conflict, notFound } from "./errors";
import { audit, emit } from "./events";
import { recordOutcome, variantFor } from "./improve";
import type { Mailer } from "./mailer";
import { type Channel, PERMANENT, SWITCHES, type Switch, type Switches, channelCheck, rulesFor } from "./outreach-rules";
import type { VoiceCaller } from "./voice";

/*
 * Outreach sequences (doc 15 §6ب گام ۴). Texts and sequences live in Git (data/outreach/), the plan for each
 * company lives here: one `touches` row per step. Javad approves the first touch of a company and the rest
 * follows on its own; a reply, a check-up, a "no" or an opt-out cancels everything still open.
 * Email is sent by the app; LinkedIn and phone are tasks for a person (LinkedIn bans automation; calls
 * need the Registro check in Italy and, for an AI voice, a disclosure).
 */

const DIR = join(process.cwd(), "data/outreach");

const sequencesSchema = z.object({
  sequences: z.record(z.string(), z.object({ when: z.string(), steps: z.array(z.object({ id: z.string(), channel: z.enum(["email", "linkedin", "phone"]), day: z.number().min(0) })) })),
});
const text = z.object({ subject: z.string().optional(), body: z.string() });
const templatesSchema = z.object({
  signals: z.record(z.string(), z.record(z.string(), z.string())),
  steps: z.record(z.string(), z.record(z.string(), text)),
});
export type SequenceId = "cold" | "warm" | "callback" | "warm-call";

let seqCache: z.infer<typeof sequencesSchema>["sequences"] | null = null;
export function loadSequences() {
  seqCache ??= sequencesSchema.parse(JSON.parse(readFileSync(join(DIR, "sequences.json"), "utf8"))).sequences;
  return seqCache;
}

const tplCache = new Map<string, z.infer<typeof templatesSchema>>();
export function loadTemplates(industry: string) {
  if (!tplCache.has(industry)) tplCache.set(industry, templatesSchema.parse(JSON.parse(readFileSync(join(DIR, "templates", `${industry}.json`), "utf8"))));
  return tplCache.get(industry)!;
}

// Strongest signal first: it decides the personal line when no agent wrote one.
const SIGNAL_ORDER = ["affectedByObligation", "hiringRepetitiveRoles", "slowServiceReviews", "growing"];

export function signalLine(industry: string, lang: string, signals: Record<string, unknown>) {
  const lines = loadTemplates(industry).signals[lang] ?? {};
  const hit = SIGNAL_ORDER.find((s) => {
    const v = signals[s];
    return Array.isArray(v) ? v.length > 0 : Boolean(v);
  });
  return lines[hit ?? "default"] ?? lines.default ?? "";
}

export type RenderContext = {
  company: string;
  firstName?: string | null;
  city?: string | null;
  signal: string;
  deadline: string;
  appUrl: string;
  locale: string;
  industry: string;
  prospectId: string;
  touchId: string;
  sender: string;
  brand: string;
  country: string;
  // where we found the contact, named in the first cold email (GDPR art. 14)
  source?: string;
  // the company's own page (falls back to the plain check-up link)
  pageUrl?: string;
};

// Calls are made by a person; an AI voice (callbacks only) opens with the AI disclosure instead.
const OPENING: Record<string, (sender: string, brand: string) => string> = {
  it: (s, b) => `Buongiorno, sono ${s} di ${b}.`,
  de: (s, b) => `Guten Tag, hier ist ${s} von ${b}.`,
  fa: (s, b) => `سلام، ${s} از ${b} هستم.`,
  en: (s, b) => `Hello, this is ${s} from ${b}.`,
};

const GREETING: Record<string, (n?: string | null) => string> = {
  it: (n) => (n ? `Buongiorno ${n},` : "Buongiorno,"),
  de: (n) => (n ? `Guten Tag ${n},` : "Guten Tag,"),
  fa: (n) => (n ? `سلام ${n}،` : "سلام،"),
  en: (n) => (n ? `Hello ${n},` : "Hello,"),
};

export function fill(tpl: string, c: RenderContext, lang: string) {
  const short = c.prospectId.slice(0, 8);
  const vars: Record<string, string> = {
    greeting: (GREETING[lang] ?? GREETING.en)(c.firstName),
    company: c.company,
    city: c.city ?? "",
    signal: c.signal,
    deadline: c.deadline,
    checkupUrl: `${c.appUrl}/${c.locale}/checkup?industry=${c.industry}&from=out-${short}`,
    pageUrl: c.pageUrl ?? `${c.appUrl}/${c.locale}/checkup?industry=${c.industry}&from=out-${short}`,
    hubUrl: `${c.appUrl}/${c.locale}/hub/${c.industry}`,
    optoutUrl: `${c.appUrl}/api/v1/outreach/optout?t=${c.touchId}`,
    privacyUrl: `${c.appUrl}/${c.locale}/legal`,
    source: c.source ?? "Google Maps, sito web",
    sender: c.sender,
    brand: c.brand,
    opening: (OPENING[lang] ?? OPENING.en)(c.sender, c.brand),
    disclosure: rulesFor(c.country).aiVoiceDisclosure.replace("{brand}", c.brand),
  };
  return tpl.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

export function renderStep(stepId: string, c: RenderContext, personal: { local: string; fa: string }) {
  const tpl = loadTemplates(c.industry);
  const lang = c.locale.slice(0, 2);
  const step = tpl.steps[stepId];
  if (!step?.[lang]) throw new Error(`no template ${c.industry}/${stepId}/${lang}`);
  const local = { ...c, signal: personal.local };
  const fa = { ...c, signal: personal.fa };
  return {
    subject: step[lang].subject ? fill(step[lang].subject!, local, lang) : null,
    body: fill(step[lang].body, local, lang),
    bodyFa: step.fa ? fill(step.fa.body, fa, "fa") : null,
  };
}

/* ───────────── planning ───────────── */

type ProspectRow = typeof prospects.$inferSelect;
type ContactRow = typeof contacts.$inferSelect;

/* ───────────── channel switches (Javad, per country) ───────────── */

export async function getSwitches(db: DbOrTx, country: string): Promise<Switches> {
  const rows = await db.select().from(channelSwitches).where(eq(channelSwitches.country, country.toUpperCase()));
  return Object.fromEntries(rows.map((r) => [r.channel, r.enabled]));
}

export async function allSwitches(db: Db) {
  return db.select().from(channelSwitches);
}

export async function setSwitch(db: Db, actor: Actor, country: string, channel: Switch, enabled: boolean) {
  z.enum(SWITCHES).parse(channel);
  const cc = z.string().length(2).parse(country).toUpperCase();
  return db.transaction(async (tx) => {
    await tx
      .insert(channelSwitches)
      .values({ country: cc, channel, enabled, updatedBy: `${actor.type}:${actor.id}` })
      .onConflictDoUpdate({ target: [channelSwitches.country, channelSwitches.channel], set: { enabled, updatedBy: `${actor.type}:${actor.id}` } });
    await emit(tx, actor, "outreach.switch_changed", { type: "channel", id: `${cc}:${channel}` }, { enabled });
    await audit(tx, actor, "outreach.switch_changed", { type: "channel", id: `${cc}:${channel}` }, null, { enabled });
  });
}

export const reachOf = (p: ProspectRow, c: ContactRow | undefined, switches: Switches = {}) => ({
  country: p.country,
  email: c?.email,
  emailConsent: c?.emailConsent,
  legalBasis: c?.legalBasis,
  switches,
  callbackRequested: p.sequence === "callback",
  phone: c?.phone ?? p.phone,
  rpoCheckedAt: p.rpoCheckedAt,
  rpoListed: p.rpoListed,
  presumedInterest: Boolean(p.interestedAt || p.repliedAt || p.checkupId),
  doNotContact: p.stage === "do_not_contact",
});

export function contactFor(channel: Channel, list: ContactRow[]) {
  if (channel === "email") return list.find((c) => c.email && c.emailConsent) ?? list.find((c) => c.email);
  if (channel === "linkedin") return list.find((c) => c.linkedinUrl) ?? list.find((c) => c.name) ?? list[0];
  return list.find((c) => c.phone) ?? list[0];
}

const LANG_OF: Record<string, string> = { IT: "it", DE: "de", AT: "de" };

export type PlanOptions = {
  sequence: SequenceId;
  appUrl: string;
  sender: string;
  brand: string;
  deadline: string;
  personal?: { local?: string; fa?: string };
  pageUrl?: string;
  // add steps without moving the company to another sequence (a warm call next to the cold sequence)
  keepSequence?: boolean;
  // "calls": calls the person asked for are tasks for a person right away; every email still waits for Javad
  approved?: boolean | "calls";
  now?: Date;
};

export async function planTouches(tx: DbOrTx, p: ProspectRow, list: ContactRow[], o: PlanOptions) {
  const now = o.now ?? new Date();
  const steps = loadSequences()[o.sequence]?.steps;
  const switches = await getSwitches(tx, p.country);
  if (!steps) throw new Error(`unknown sequence ${o.sequence}`);
  const lang = LANG_OF[p.country] ?? "en";
  const locale = `${lang}-${p.country.toLowerCase()}`;
  // the agent's own line when it wrote one, else the line for the strongest signal; while the opening experiment
  // runs, half the researched companies still get the signal line so we learn which one gets more replies
  const own = o.personal?.local && !o.keepSequence ? (await variantFor(tx, "outreach.opening", p.id)) !== "signal" : true;
  const mine = own ? o.personal : undefined;
  const personal = { local: mine?.local ?? signalLine(p.industry, lang, p.signals), fa: mine?.fa ?? signalLine(p.industry, "fa", p.signals) };
  const rows = [];
  for (const [position, s] of steps.entries()) {
    const c = contactFor(s.channel, list);
    const why = channelCheck(s.channel, reachOf({ ...p, sequence: o.sequence }, c, switches), now);
    const id = crypto.randomUUID();
    const ctx: RenderContext = {
      company: p.name, firstName: c?.name?.split(" ")[0], city: p.city, signal: personal.local, deadline: o.deadline,
      appUrl: o.appUrl, locale, industry: p.industry, prospectId: p.id, touchId: id, sender: o.sender, brand: o.brand, country: p.country, pageUrl: o.pageUrl,
    };
    const r = renderStep(s.id, ctx, personal);
    const ok = o.approved === true || (o.approved === "calls" && s.channel === "phone");
    rows.push({
      id, prospectId: p.id, contactId: c?.id ?? null, step: s.id, position, channel: s.channel, locale, ...r,
      // switch off, basis missing or Registro unchecked can still change: those wait; the rest is skipped
      status: why && PERMANENT.has(why) ? "skipped" : ok ? "approved" : "draft",
      blockedReason: why,
      dueAt: new Date(now.getTime() + s.day * 864e5),
      approvedBy: ok ? "system:inbound" : null,
    });
  }
  if (rows.length) await tx.insert(touches).values(rows);
  if (!o.keepSequence) await tx.update(prospects).set({ sequence: o.sequence }).where(eq(prospects.id, p.id));
  return rows;
}

const OPEN = ["draft", "approved"];

export async function cancelOpen(tx: DbOrTx, prospectId: string, reason: string) {
  await tx
    .update(touches)
    .set({ status: "cancelled", blockedReason: reason })
    .where(and(eq(touches.prospectId, prospectId), inArray(touches.status, OPEN)));
}

/* ───────────── approval (Javad) ───────────── */

/** Approves a company's whole sequence; day offsets start from now. */
export async function approveSequence(db: Db, actor: Actor, prospectId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const list = await tx.select().from(touches).where(and(eq(touches.prospectId, prospectId), eq(touches.status, "draft"))).orderBy(asc(touches.position));
    if (!list.length) throw conflict("nothing waiting for approval");
    const [p] = await tx.select().from(prospects).where(eq(prospects.id, prospectId));
    const steps = loadSequences()[p.sequence ?? "cold"]?.steps ?? [];
    await setPageStatus(tx, prospectId, "live"); // the company's page goes live with the first message
    for (const t of list) {
      const day = steps.find((s) => s.id === t.step)?.day ?? 0;
      await tx.update(touches).set({ status: "approved", approvedBy: `${actor.type}:${actor.id}`, dueAt: new Date(now.getTime() + day * 864e5) }).where(eq(touches.id, t.id));
    }
    await emit(tx, actor, "outreach.approved", { type: "prospect", id: prospectId }, { industry: p.industry, sequence: p.sequence, touches: list.length });
    await audit(tx, actor, "outreach.approved", { type: "prospect", id: prospectId }, null, { touches: list.length });
    return list.length;
  });
}

export async function rejectSequence(db: Db, actor: Actor, prospectId: string, note?: string) {
  return db.transaction(async (tx) => {
    await cancelOpen(tx, prospectId, note ? `rejected: ${note}` : "rejected");
    await tx.update(prospects).set({ note: note ?? null }).where(eq(prospects.id, prospectId));
    await audit(tx, actor, "outreach.rejected", { type: "prospect", id: prospectId }, null, { note });
  });
}

/** Javad edits a text before approving it. */
export async function editTouch(db: Db, actor: Actor, touchId: string, input: { body: string; subject?: string | null }) {
  const body = z.string().min(5).max(4000).parse(input.body);
  return db.transaction(async (tx) => {
    const [t] = await tx.select().from(touches).where(eq(touches.id, touchId));
    if (!t) throw notFound("touch");
    if (t.status !== "draft") throw conflict("only drafts can be edited");
    await tx.update(touches).set({ body, subject: input.subject ?? t.subject }).where(eq(touches.id, touchId));
    await audit(tx, actor, "touch.edited", { type: "touch", id: touchId }, { body: t.body }, { body });
  });
}

/* ───────────── doing the touches ───────────── */

export const OUTCOMES = {
  linkedin: ["sent", "accepted", "replied", "not_interested"],
  phone: ["no_answer", "talked", "callback", "interested", "meeting", "not_interested", "wrong_number"],
  email: ["replied", "interested", "meeting", "not_interested"],
} as const;

// outcome → stage it moves the company to (never backwards)
const STAGE_OF: Record<string, string> = { replied: "replied", accepted: "contacted", sent: "contacted", no_answer: "contacted", talked: "contacted", callback: "replied", interested: "interested", meeting: "meeting", not_interested: "lost" };

/** A person did a LinkedIn or phone task (or reports an email reply). */
export async function completeTouch(db: Db, actor: Actor, touchId: string, outcome: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const [t] = await tx.select().from(touches).where(eq(touches.id, touchId)).for("update");
    if (!t) throw notFound("touch");
    const allowed = OUTCOMES[t.channel as Channel] as readonly string[];
    if (!allowed.includes(outcome)) throw conflict(`outcome must be one of ${allowed.join(", ")}`);
    if (t.status !== "approved" && t.status !== "sent") throw conflict(`touch is ${t.status}`);
    if (t.status === "approved" && t.channel === "phone") {
      const [p] = await tx.select().from(prospects).where(eq(prospects.id, t.prospectId));
      const [c] = t.contactId ? await tx.select().from(contacts).where(eq(contacts.id, t.contactId)) : [];
      const why = channelCheck("phone", reachOf(p, c, await getSwitches(tx, p.country)), now);
      if (why) throw conflict(why);
    }
    await tx.update(touches).set({ status: "done", sentAt: t.sentAt ?? now, outcome }).where(eq(touches.id, touchId));
    await moveStage(tx, actor, t.prospectId, STAGE_OF[outcome] ?? "contacted", now, `${t.channel}:${outcome}`);
    if (outcome === "wrong_number") await tx.update(prospects).set({ phone: null }).where(eq(prospects.id, t.prospectId));
  });
}

/** Sends approved emails that are due. Re-checks the rules right before sending. */
export async function sendDueEmails(db: Db, mailer: Mailer, now = new Date(), cap = 50) {
  const due = await db
    .select({ t: touches, p: prospects, c: contacts })
    .from(touches)
    .innerJoin(prospects, eq(prospects.id, touches.prospectId))
    .leftJoin(contacts, eq(contacts.id, touches.contactId))
    .where(and(eq(touches.status, "approved"), eq(touches.channel, "email"), lte(touches.dueAt, now)))
    .orderBy(asc(touches.dueAt))
    .limit(cap);
  let sent = 0;
  for (const { t, p, c } of due) {
    const why = channelCheck("email", reachOf(p, c ?? undefined, await getSwitches(db, p.country)), now);
    if (why || !c?.email) {
      // A permanent reason skips the email; a switch or a missing basis keeps it waiting with the reason shown.
      const reason = why ?? "no email";
      await db.update(touches).set(PERMANENT.has(reason) ? { status: "skipped", blockedReason: reason } : { blockedReason: reason }).where(eq(touches.id, t.id));
      continue;
    }
    try {
      const id = await mailer.send({ to: c.email, subject: t.subject ?? p.name, text: t.body, unsubscribeUrl: t.body.match(/https?:\S+optout\?t=[\w-]+/)?.[0] });
      await db.transaction(async (tx) => {
        await tx.update(touches).set({ status: "sent", sentAt: now, outcome: id }).where(eq(touches.id, t.id));
            await moveStage(tx, { type: "system", id: "outbox" }, p.id, "contacted", now, "email:sent");
      });
      sent++;
    } catch (err) {
      // Leave it approved: the next run retries. The cockpit shows the error.
      await db.update(touches).set({ blockedReason: `send failed: ${(err as Error).message.slice(0, 200)}` }).where(eq(touches.id, t.id));
    }
  }
  return { due: due.length, sent };
}

/** Link in every email and on the company page: stops all contact at once, unsubscribes the lead, removes the page. */
export async function optOut(db: Db, token: string) {
  return db.transaction(async (tx) => {
    const byPage = /^\w{6,20}$/.test(token) && !z.uuid().safeParse(token).success;
    const [t] = byPage
      ? await tx.select({ prospectId: companyPages.prospectId }).from(companyPages).where(eq(companyPages.code, token))
      : z.uuid().safeParse(token).success
        ? await tx.select({ prospectId: touches.prospectId }).from(touches).where(eq(touches.id, token))
        : [];
    if (!t) throw notFound("link");
    const actor: Actor = { type: "system", id: "optout-link" };
    await moveStage(tx, actor, t.prospectId, "do_not_contact", new Date(), "opt-out link");
    await unsubscribeLead(tx, t.prospectId);
    await setPageStatus(tx, t.prospectId, "archived");
    await emit(tx, actor, "prospect.opted_out", { type: "prospect", id: t.prospectId }, {});
  });
}

/**
 * AI voice calls for phone touches that are due, when Javad switched AI calls on for the country. The
 * provider calls back to /api/v1/outreach/voice with the outcome. Human calls stay tasks in the cockpit.
 */
export async function startDueAiCalls(db: Db, voice: VoiceCaller, env: { brand: string }, now = new Date(), cap = 20) {
  const due = await db
    .select({ t: touches, p: prospects, c: contacts })
    .from(touches)
    .innerJoin(prospects, eq(prospects.id, touches.prospectId))
    .leftJoin(contacts, eq(contacts.id, touches.contactId))
    .where(and(eq(touches.status, "approved"), eq(touches.channel, "phone"), lte(touches.dueAt, now)))
    .orderBy(asc(touches.dueAt))
    .limit(cap * 3);
  let started = 0;
  for (const { t, p, c } of due) {
    if (started >= cap) break;
    const reach = reachOf(p, c ?? undefined, await getSwitches(db, p.country));
    if (channelCheck("phone", reach, now, true)) continue; // stays a task for a person
    try {
      const callId = await voice.call({
        to: reach.phone!,
        // AI Act art. 50: the first sentence says it is an AI
        firstMessage: rulesFor(p.country).aiVoiceDisclosure.replace("{brand}", env.brand),
        script: t.body,
        language: t.locale.slice(0, 2),
        metadata: { touchId: t.id, prospectId: p.id },
      });
      await db.update(touches).set({ status: "sent", sentAt: now, outcome: `call:${callId}` }).where(eq(touches.id, t.id));
      started++;
    } catch (err) {
      await db.update(touches).set({ blockedReason: `AI call failed: ${(err as Error).message.slice(0, 200)}` }).where(eq(touches.id, t.id));
    }
  }
  return { started };
}

/**
 * Optional warm call (Javad's switch "call-warm"): when a company replies or opens its page, a person calls
 * right away. One open call at a time; nothing happens while the switch is off.
 */
export async function planWarmCall(tx: DbOrTx, prospectId: string, now = new Date()) {
  const [p] = await tx.select().from(prospects).where(eq(prospects.id, prospectId));
  if (!p || p.stage === "do_not_contact" || p.stage === "won" || p.stage === "lost") return false;
  if (!(await getSwitches(tx, p.country))["call-warm"]) return false;
  const open = await tx.select({ id: touches.id }).from(touches).where(and(eq(touches.prospectId, prospectId), eq(touches.channel, "phone"), inArray(touches.status, ["draft", "approved"])));
  if (open.length) return false;
  const list = await tx.select().from(contacts).where(eq(contacts.prospectId, prospectId));
  const rows = await planTouches(tx, p, list, { sequence: "warm-call", ...planEnv(), deadline: "", approved: "calls", keepSequence: true, now });
  return rows.some((r) => r.status === "approved");
}
