import { createHash, randomInt } from "node:crypto";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { CONTRACT_TITLES, type Clause, contractLang, CUSTOMER_CLAUSES, DPA_ANNEX, DRAFT_BANNER, INDEPENDENCE_QUESTIONS, type Lang, packFor, PARTNER_CLAUSES } from "@/config/jurisdictions";
import type { Db, DbOrTx, Tx } from "@/db";
import { contracts, memberships, milestones, orders, organizations, partners, servicePackages, signatureCodes, user } from "@/db/schema";
import type { Actor } from "./actor";
import { AppError, notFound } from "./errors";
import { audit, emit } from "./events";
import { requestInvoice } from "./finance";
import { mailerFromEnv } from "./mailer";
import { money, ourName, queueCode } from "./notify";
import { createCustomer } from "./portal";
import { convertOrder } from "./projects";

/*
 * Contract factory (step 8, doc 15 §6ج). Contracts are assembled from the clause library of the country pack
 * with the data already in the system (order, package, milestones, prices); Javad approves with one click on the
 * one-page summary, the other side signs in their portal with a one-time code, and onerous clauses get a second,
 * separate code (Italy: art. 1341-1342 c.c., Cassazione n. 20945/2026). Nothing starts before that:
 * customers → deposit → project; partners → first job offer.
 */

const by = (a: Actor) => `${a.type}:${a.id}`;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const CODE_MINUTES = 15;

function fill(text: string, vars: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
}

function assemble(kind: "customer" | "partner", lang: Lang, country: string | null, vars: Record<string, string>) {
  const pack = packFor(country);
  const clauses: Clause[] = kind === "customer" ? CUSTOMER_CLAUSES : PARTNER_CLAUSES;
  const v = { ...vars, law: pack.law[lang], court: pack.court };
  const title = CONTRACT_TITLES[kind][lang];
  const lines = [`# ${title}`, ...(pack.reviewed ? [] : [`_${DRAFT_BANNER[lang]}_`]), "", fill(vars.parties, v), ""];
  clauses.forEach((c, i) => lines.push(`**${i + 1}. ${fill(c.title[lang], v)}**${c.onerous ? " ✱" : ""}`, fill(c.text[lang], v), ""));
  if (kind === "customer") lines.push(fill(DPA_ANNEX[lang], v));
  const onerous = clauses.map((c, i) => ({ c, i })).filter(({ c }) => c.onerous).map(({ c, i }) => ({ id: c.id, title: `${i + 1}. ${fill(c.title[lang], v)}` }));
  return { pack, title, body: lines.join("\n").trim(), onerous };
}

/* ───────────── Customer: order → contract (Javad's click) ───────────── */

/**
 * Javad presses "Send contract" on an order: the customer account is created if new, the contract is built from
 * the package and its milestones, and the customer is asked to sign. The deposit is the first milestone's share.
 */
export async function sendContract(db: Db, actor: Actor, orderId: string) {
  return db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!o) throw notFound("order");
    if (o.status !== "new") throw new AppError(409, "already_decided", "order already handled");
    const [pkg] = await tx.select().from(servicePackages).where(eq(servicePackages.slug, o.packageSlug));
    if (!pkg) throw notFound("package");
    let orgId = o.orgId;
    let password = "";
    // a returning buyer (same email) gets the order on their existing company, not a second account
    if (!orgId && o.email) {
      const [known] = await tx.select({ orgId: memberships.orgId }).from(memberships).innerJoin(user, eq(user.id, memberships.userId)).innerJoin(organizations, eq(organizations.id, memberships.orgId)).where(and(eq(user.email, o.email.toLowerCase()), eq(organizations.kind, "customer"))).limit(1);
      orgId = known?.orgId ?? null;
    }
    if (!orgId) {
      const c = await createCustomer(tx, actor, { name: o.company!, country: o.country ?? "IT", industry: o.industry ?? "other", locale: o.locale, email: o.email!, contactName: o.company! });
      orgId = c.org.id;
      password = c.password;
    }
    const [org] = await tx.select().from(organizations).where(eq(organizations.id, orgId));
    const lang = contractLang(o.locale ?? org.locale);
    // deposit = the first milestone's share, at most half: the customer never prepays the whole job
    const deposit = Math.round((pkg.setupEur * Math.min(pkg.milestones[0]?.sharePct ?? 50, 50)) / 100);
    const msText = pkg.milestones.map((m, i) => `${i + 1}) ${m.titles?.[lang] ?? m.title} (${pkg.milestones.length - 1 === i ? money(pkg.setupEur - pkg.milestones.slice(0, -1).reduce((s, x) => s + Math.round((pkg.setupEur * x.sharePct) / 100), 0), lang) : money(Math.round((pkg.setupEur * m.sharePct) / 100), lang)})`).join("; ");
    const us = await ourName(tx);
    const pack = packFor(org.country);
    const built = assemble("customer", lang, org.country, {
      company: us, customer: org.name, service: pkg.titles[lang] ?? pkg.title, setup: money(pkg.setupEur, lang), monthly: money(pkg.monthlyEur, lang), deposit: money(deposit, lang), days: String(pack.paymentDays), milestones: msText,
      parties: `${us} – ${org.name}${o.vat ? ` (${o.vat})` : ""}`,
    });
    const summary = {
      give: [`${pkg.title}: ${pkg.milestones.map((m) => m.title).join(" → ")}`, `Monthly service after the last milestone (€${pkg.monthlyEur}/month, cancel with 30 days)`, "DPA annex (we are processor), EU data"],
      get: [`€${pkg.setupEur} set-up + €${pkg.monthlyEur}/month (+ VAT where due)`, `Deposit €${deposit} before any work starts`],
      money: [`Balance per accepted milestone, ${pack.paymentDays} days`, "Late interest D.Lgs 231/2002 + €40", "Pause after 14 days late"],
      risks: [...(built.pack.reviewed ? [] : [`${built.pack.name} template ${built.pack.templateVersion} not reviewed by a lawyer yet`]), `${built.onerous.length} onerous clauses need the customer's separate code`],
    };
    const [c] = await tx
      .insert(contracts)
      .values({ kind: "customer", orgId, orderId, jurisdiction: built.pack.code, language: lang, templateVersion: built.pack.templateVersion, reviewed: built.pack.reviewed, title: `${built.title}: ${pkg.titles[lang] ?? pkg.title}`, body: built.body, onerous: built.onerous, summary, amountEur: pkg.setupEur, monthlyEur: pkg.monthlyEur, depositEur: deposit, approvedBy: by(actor), createdBy: by(actor), evidence: { hash: sha(built.body) } })
      .returning();
    await tx.update(orders).set({ status: "contract", orgId, contractId: c.id, depositEur: deposit }).where(eq(orders.id, orderId));
    await emit(tx, actor, "contract.sent", { type: "contract", id: c.id }, { kind: "customer", orgId, orderId, title: c.title, depositEur: deposit });
    await audit(tx, actor, "contract.sent", { type: "contract", id: c.id }, null, { orderId, template: built.pack.templateVersion, depositEur: deposit });
    return { contract: c, password, orgId };
  });
}

/* ───────────── Partner: framework agreement before the first offer ───────────── */

export async function createPartnerContract(tx: Tx, actor: Actor, partnerId: string) {
  const [p] = await tx.select().from(partners).where(eq(partners.id, partnerId));
  if (!p) throw notFound("partner");
  const [open] = await tx.select({ id: contracts.id }).from(contracts).where(and(eq(contracts.partnerId, partnerId), eq(contracts.kind, "partner"), eq(contracts.status, "sent")));
  if (open) return open;
  const lang = contractLang(p.locale);
  const us = await ourName(tx);
  const built = assemble("partner", lang, "IT", { company: us, partner: p.name, parties: `${us} – ${p.name} (${p.country})` });
  const [c] = await tx
    .insert(contracts)
    .values({ kind: "partner", partnerId, jurisdiction: built.pack.code, language: lang, templateVersion: built.pack.templateVersion, reviewed: built.pack.reviewed, title: built.title, body: built.body, onerous: built.onerous, summary: { give: ["Job offers matched to skills, no obligation"], get: ["NDA 3 years", "Sub-processor duties", "White-label", "Non-circumvention 12 months"], money: ["Paid per accepted job by level"], risks: built.pack.reviewed ? [] : ["Template not reviewed by a lawyer yet"] }, approvedBy: "template", createdBy: by(actor), evidence: { hash: sha(built.body) } })
    .returning();
  await emit(tx, actor, "contract.sent", { type: "contract", id: c.id }, { kind: "partner", partnerId, title: c.title });
  await audit(tx, actor, "contract.sent", { type: "contract", id: c.id }, null, { partnerId, template: built.pack.templateVersion });
  return c;
}

/** Partners activated before contracts existed (or whose contract was cancelled) get theirs; worker, hourly. */
export async function ensurePartnerContracts(db: Db) {
  const active = await db.select({ id: partners.id }).from(partners).where(eq(partners.status, "active"));
  const have = new Set((await db.select({ p: contracts.partnerId }).from(contracts).where(and(eq(contracts.kind, "partner"), inArray(contracts.status, ["sent", "signed"])))).map((r) => r.p));
  const missing = active.filter((p) => !have.has(p.id));
  for (const p of missing) await db.transaction((tx) => createPartnerContract(tx, { type: "system", id: "contracts" }, p.id));
  return missing.length;
}

/** Offers go only to partners who signed the framework agreement (process gap "partner.activated"). */
export async function signedPartners(db: DbOrTx) {
  return new Set((await db.select({ p: contracts.partnerId }).from(contracts).where(and(eq(contracts.kind, "partner"), eq(contracts.status, "signed")))).map((r) => r.p!));
}

/* ───────────── Signing with one-time codes ───────────── */

export type Signer = { email: string; name: string; locale: string };

/** Sends a code for a step. Without a mailer (local demo) the code is returned to show on screen, marked as such. */
export async function requestSignCode(db: Db, contractId: string, step: "sign" | "clauses", signer: Signer, now = new Date(), gen = () => String(randomInt(0, 1_000_000)).padStart(6, "0")) {
  const [c] = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!c) throw notFound("contract");
  if (c.status !== "sent") throw new AppError(409, "not_open", "contract is not waiting for a signature");
  if (step === "clauses" && !c.evidence?.signedAt) throw new AppError(409, "sign_first", "sign the contract first");
  const code = gen();
  await db.transaction(async (tx) => {
    await tx.update(signatureCodes).set({ usedAt: now }).where(and(eq(signatureCodes.contractId, contractId), eq(signatureCodes.step, step), isNull(signatureCodes.usedAt)));
    await tx.insert(signatureCodes).values({ contractId, step, codeHash: sha(`${contractId}:${step}:${code}`), email: signer.email, expiresAt: new Date(now.getTime() + CODE_MINUTES * 60_000) });
    await queueCode(tx, { audience: c.kind === "customer" ? "customer" : "partner", email: signer.email, locale: signer.locale, name: signer.name, orgId: c.orgId, partnerId: c.partnerId }, code, step);
  });
  return { demoCode: mailerFromEnv() ? null : code };
}

export const signInput = z.object({ code: z.string().trim().regex(/^\d{6}$/), answers: z.record(z.string(), z.boolean()).optional() });

/**
 * Checks a code. "sign" records the signature of the text (hash); "clauses" records the separate approval of the
 * onerous clauses and completes the contract. Then the next step starts: deposit (customer) or offers (partner).
 */
export async function confirmSignCode(db: Db, contractId: string, step: "sign" | "clauses", input: z.input<typeof signInput>, meta: { signer: Signer; ip?: string | null; ua?: string | null }, now = new Date()) {
  const v = signInput.parse(input);
  const result = await db.transaction(async (tx) => {
    const [c] = await tx.select().from(contracts).where(eq(contracts.id, contractId)).for("update");
    if (!c || c.status !== "sent") throw new AppError(409, "not_open", "contract is not waiting for a signature");
    const [row] = await tx.select().from(signatureCodes).where(and(eq(signatureCodes.contractId, contractId), eq(signatureCodes.step, step), isNull(signatureCodes.usedAt))).orderBy(desc(signatureCodes.createdAt)).limit(1);
    if (!row || row.expiresAt < now || row.attempts >= 5) throw new AppError(400, "code_expired", "code expired: ask for a new one");
    if (row.email !== meta.signer.email) throw new AppError(403, "other_signer", "the code was sent to someone else");
    if (row.codeHash !== sha(`${contractId}:${step}:${v.code}`)) {
      await tx.update(signatureCodes).set({ attempts: row.attempts + 1 }).where(eq(signatureCodes.id, row.id));
      return { ok: false as const };
    }
    await tx.update(signatureCodes).set({ usedAt: now }).where(eq(signatureCodes.id, row.id));
    // ip and browser of the signature itself (first code) are kept; the second code adds its time
    const evidence = { ...(c.evidence ?? { hash: sha(c.body) }), ip: c.evidence?.ip ?? meta.ip ?? null, ua: c.evidence?.ua ?? meta.ua?.slice(0, 300) ?? null, ...(v.answers ? { answers: v.answers } : {}) };
    const actor: Actor = { type: "user", id: meta.signer.email };
    if (step === "sign") {
      // the text signed is the text stored: any later change would break the hash
      if (sha(c.body) !== evidence.hash) throw new AppError(409, "changed", "contract text changed");
      await tx.update(contracts).set({ evidence: { ...evidence, signedAt: now.toISOString() }, signerName: meta.signer.name, signerEmail: meta.signer.email }).where(eq(contracts.id, contractId));
      await audit(tx, actor, "contract.signed_text", { type: "contract", id: contractId }, null, { hash: evidence.hash });
      // a contract without onerous clauses is complete with the first code
      if (c.onerous.length) return { ok: true as const, done: false, contract: c };
    } else if (!c.evidence?.signedAt) throw new AppError(409, "sign_first", "sign the contract first");
    const [done] = await tx.update(contracts).set({ status: "signed", signedAt: now, evidence: { ...evidence, ...(step === "clauses" ? { signedAt: c.evidence?.signedAt, clausesAt: now.toISOString() } : { signedAt: now.toISOString() }) } }).where(eq(contracts.id, contractId)).returning();
    await emit(tx, actor, "contract.signed", { type: "contract", id: contractId }, { kind: c.kind, orgId: c.orgId, partnerId: c.partnerId, orderId: c.orderId, independenceFlags: independenceFlags(v.answers ?? c.evidence?.answers) });
    await audit(tx, actor, "contract.signed", { type: "contract", id: contractId }, { status: "sent" }, { status: "signed" });
    if (c.kind === "customer" && c.orderId) await afterCustomerSigned(tx, actor, done, now);
    return { ok: true as const, done: true, contract: done };
  });
  // nothing to pay first: the project starts at once
  if (result.ok && result.done && result.contract.kind === "customer" && result.contract.orderId && result.contract.depositEur === 0) await convertOrder(db, { type: "system", id: "contract" }, result.contract.orderId);
  return result;
}

/** A "no" to any independence question flags false self-employment risk for Javad. */
export function independenceFlags(answers?: Record<string, boolean>) {
  if (!answers) return [];
  return INDEPENDENCE_QUESTIONS.filter((q) => answers[q.id] === false).map((q) => q.id);
}

async function afterCustomerSigned(tx: Tx, actor: Actor, c: typeof contracts.$inferSelect, now: Date) {
  await tx.update(orders).set({ status: "signed" }).where(eq(orders.id, c.orderId!));
  if (c.depositEur > 0) await requestInvoice(tx, actor, { orgId: c.orgId!, kind: "deposit", title: c.title, netEur: c.depositEur, contractId: c.id, orderId: c.orderId }, now);
}

/* ───────────── Reading ───────────── */

export async function getContract(db: DbOrTx, id: string) {
  const [c] = await db.select().from(contracts).where(eq(contracts.id, id));
  if (!c) throw notFound("contract");
  return c;
}

export async function listContracts(db: Db) {
  return db
    .select({ contract: contracts, org: organizations.name, partner: partners.name })
    .from(contracts)
    .leftJoin(organizations, eq(organizations.id, contracts.orgId))
    .leftJoin(partners, eq(partners.id, contracts.partnerId))
    .orderBy(desc(contracts.createdAt));
}

export async function contractsFor(db: DbOrTx, who: { orgId?: string; partnerId?: string }) {
  return db.select().from(contracts).where(who.orgId ? eq(contracts.orgId, who.orgId) : eq(contracts.partnerId, who.partnerId!)).orderBy(desc(contracts.createdAt));
}

/** Milestones of a contract's project, for the cockpit view. */
export async function contractMilestones(db: Db, orderId: string | null) {
  if (!orderId) return [];
  const [o] = await db.select({ projectId: orders.projectId }).from(orders).where(eq(orders.id, orderId));
  return o?.projectId ? db.select().from(milestones).where(eq(milestones.projectId, o.projectId)) : [];
}
