import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { z } from "zod";
import { EU, packFor } from "@/config/jurisdictions";
import type { Db, DbOrTx, Tx } from "@/db";
import { companyProfile, invoices, milestones, orders, organizations, partners, payouts, projects, subscriptions } from "@/db/schema";
import type { Actor } from "./actor";
import { AppError, notFound } from "./errors";
import { audit, emit } from "./events";
import { markPaid } from "./partners";
import { convertOrder } from "./projects";

/*
 * Money (step 8, doc 15 §6ج): payment request first, legal invoice when paid (Italy invoices services at payment).
 * Deposit before work, then each accepted milestone (minus the deposit), then the monthly fee. Dunning by date.
 * Rails are adapters: SEPA transfer with the EPC QR code now (instant and free since Oct 2025), Stripe later.
 * The e-invoice (SdI) goes through a provider adapter once the business is registered; until then invoices
 * stay "paid, waiting for registration" and no legal number is given.
 */

const DAY = 864e5;
const round2 = (n: number) => Math.round(n * 100) / 100;

/* ───────────── Our company ───────────── */

export async function getCompany(db: DbOrTx) {
  const [c] = await db.select().from(companyProfile).where(eq(companyProfile.id, "main"));
  return c ?? null;
}

const ibanRe = /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/;
export const companyInput = z.object({
  legalName: z.string().trim().min(2).max(200),
  vatId: z.string().trim().max(30).optional(),
  taxCode: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
  country: z.string().trim().length(2).default("IT"),
  iban: z.string().trim().transform((s) => s.replace(/\s+/g, "").toUpperCase()).pipe(z.string().regex(ibanRe)).optional(),
  bic: z.string().trim().max(11).optional(),
  email: z.string().trim().email().optional(),
  registered: z.boolean().default(false),
});

export async function saveCompany(db: Db, actor: Actor, input: z.input<typeof companyInput>) {
  const v = companyInput.parse(input);
  return db.transaction(async (tx) => {
    const before = await getCompany(tx);
    await tx.insert(companyProfile).values({ id: "main", ...v, country: v.country.toUpperCase() }).onConflictDoUpdate({ target: companyProfile.id, set: { ...v, country: v.country.toUpperCase() } });
    await audit(tx, actor, "company.updated", { type: "company", id: "main" }, before, v);
  });
}

/* ───────────── VAT by country pack ───────────── */

/** Italian seller: Italian customers pay 22%; EU businesses with a VAT number reverse charge; outside the EU no Italian VAT. */
export function vatFor(customerCountry: string | null, customerVat: string | null, lang: string) {
  const pack = packFor("IT");
  const cc = (customerCountry ?? "IT").toUpperCase();
  const l = (["it", "en", "de"].includes(lang) ? lang : "en") as "it" | "en" | "de";
  if (cc === "IT") return { rate: pack.vatRate, note: null };
  if (EU.has(cc)) return customerVat ? { rate: 0, note: pack.reverseCharge[l] } : { rate: pack.vatRate, note: null };
  return { rate: 0, note: pack.outsideEu[l] };
}

async function customerTax(db: DbOrTx, orgId: string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  const [o] = await db.select({ vat: orders.vat }).from(orders).where(and(eq(orders.orgId, orgId), isNotNull(orders.vat))).orderBy(desc(orders.createdAt)).limit(1);
  return { country: org?.country ?? "IT", vat: o?.vat ?? null, lang: (org?.locale ?? "en").slice(0, 2) };
}

/* ───────────── Payment requests and invoices ───────────── */

export type InvoiceInput = { orgId: string; kind: "deposit" | "milestone" | "subscription"; title: string; netEur: number; contractId?: string | null; orderId?: string | null; projectId?: string | null; milestoneId?: string | null; subscriptionId?: string | null; period?: string | null };

export async function requestInvoice(tx: Tx, actor: Actor, v: InvoiceInput, now = new Date()) {
  const t = await customerTax(tx, v.orgId);
  const vat = vatFor(t.country, t.vat, t.lang);
  const net = round2(v.netEur);
  const vatEur = round2((net * vat.rate) / 100);
  const [row] = await tx
    .insert(invoices)
    .values({ ...v, netEur: net, vatRate: vat.rate, vatEur, totalEur: round2(net + vatEur), vatNote: vat.note, reference: `LP-${randomBytes(5).toString("hex").toUpperCase()}`, dueAt: new Date(now.getTime() + packFor("IT").paymentDays * DAY) })
    .onConflictDoNothing()
    .returning();
  if (!row) return null;
  await emit(tx, actor, "invoice.requested", { type: "invoice", id: row.id }, { orgId: v.orgId, kind: v.kind, totalEur: row.totalEur, reference: row.reference });
  await audit(tx, actor, "invoice.requested", { type: "invoice", id: row.id }, null, { kind: v.kind, net, vatRate: vat.rate });
  return row;
}

/**
 * The money arrived (Javad marks it from the bank statement; bank import later). The invoice gets its legal
 * number when the business is registered; a paid deposit starts the project.
 */
export async function markInvoicePaid(db: Db, actor: Actor, invoiceId: string, now = new Date()) {
  const inv = await db.transaction(async (tx) => {
    const [i] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId)).for("update");
    if (!i) throw notFound("invoice");
    if (i.status !== "requested") throw new AppError(409, "not_open", "invoice is not waiting for payment");
    await tx.update(invoices).set({ status: "paid", paidAt: now }).where(eq(invoices.id, invoiceId));
    await emit(tx, actor, "invoice.paid", { type: "invoice", id: invoiceId }, { orgId: i.orgId, kind: i.kind, totalEur: i.totalEur });
    await audit(tx, actor, "invoice.paid", { type: "invoice", id: invoiceId }, { status: i.status }, { status: "paid" });
    await issue(tx, actor, i, now);
    return i;
  });
  if (inv.kind === "deposit" && inv.orderId) {
    const [o] = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, inv.orderId));
    if (o?.status === "signed") await convertOrder(db, actor, inv.orderId, now);
  }
  return inv;
}

/** Legal invoice number (YEAR/N, one sequence) once registered; the e-invoice provider adapter sends it to SdI later. */
async function issue(tx: Tx, actor: Actor, i: typeof invoices.$inferSelect, now: Date) {
  const co = await getCompany(tx);
  if (!co?.registered) return null;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('invoice-number'))`);
  const year = now.getUTCFullYear();
  const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(invoices).where(sql`${invoices.number} like ${`${year}/%`}`);
  const number = `${year}/${String(n + 1).padStart(4, "0")}`;
  await tx.update(invoices).set({ status: "issued", number, issuedAt: now, provider: process.env.EINVOICE_PROVIDER ?? "manual" }).where(eq(invoices.id, i.id));
  await emit(tx, actor, "invoice.issued", { type: "invoice", id: i.id }, { orgId: i.orgId, number, totalEur: i.totalEur });
  await audit(tx, actor, "invoice.issued", { type: "invoice", id: i.id }, { status: "paid" }, { status: "issued", number });
  return number;
}

/** Issues every paid invoice once the business is registered (Javad ticks "registered" in the cockpit). */
export async function issuePaid(db: Db, actor: Actor, now = new Date()) {
  const paid = await db.select().from(invoices).where(eq(invoices.status, "paid")).orderBy(asc(invoices.paidAt));
  for (const i of paid) await db.transaction((tx) => issue(tx, actor, i, now));
  return paid.length;
}

export async function cancelInvoice(db: Db, actor: Actor, invoiceId: string, why: string) {
  await db.transaction(async (tx) => {
    const [i] = await tx.update(invoices).set({ status: "cancelled" }).where(and(eq(invoices.id, invoiceId), eq(invoices.status, "requested"))).returning();
    if (!i) throw new AppError(409, "not_open", "only unpaid requests can be cancelled");
    await audit(tx, actor, "invoice.cancelled", { type: "invoice", id: invoiceId }, { status: "requested" }, { status: "cancelled", why });
  });
}

/**
 * Accepted milestone (worker, on milestone.accepted): bill its amount minus what the deposit still covers.
 * The deposit covers the first milestone by default, so the first acceptance usually bills nothing.
 */
export async function billMilestone(db: Db, milestoneId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const [m] = await tx.select().from(milestones).where(eq(milestones.id, milestoneId));
    if (!m?.orgId) return null;
    const [p] = await tx.select().from(projects).where(eq(projects.id, m.projectId));
    const deposits = p.orderId ? await tx.select().from(invoices).where(and(eq(invoices.orderId, p.orderId), eq(invoices.kind, "deposit"), inArray(invoices.status, ["paid", "issued"]))) : [];
    const deposit = deposits.reduce((s, d) => s + d.netEur, 0);
    const accepted = await tx.select().from(milestones).where(and(eq(milestones.projectId, p.id), eq(milestones.status, "accepted")));
    const covered = accepted.filter((x) => x.id !== m.id).reduce((s, x) => s + x.amountEur, 0);
    const billed = (await tx.select().from(invoices).where(and(eq(invoices.projectId, p.id), eq(invoices.kind, "milestone")))).reduce((s, x) => s + x.netEur, 0);
    const creditLeft = Math.max(0, deposit - (covered - billed));
    const due = round2(m.amountEur - Math.min(creditLeft, m.amountEur));
    if (due <= 0) return null;
    return requestInvoice(tx, { type: "system", id: "billing" }, { orgId: m.orgId, kind: "milestone", title: `${p.title}: ${m.title}`, netEur: due, projectId: p.id, milestoneId: m.id, orderId: p.orderId }, now);
  });
}

/** Monthly fees (worker, daily): one request per active subscription and month, in advance. */
export async function billSubscriptions(db: Db, now = new Date()) {
  const period = now.toISOString().slice(0, 7);
  const subs = await db.select().from(subscriptions).where(and(eq(subscriptions.status, "active"), lte(subscriptions.startedAt, now)));
  let n = 0;
  for (const s of subs) {
    if (s.monthlyEur <= 0) continue;
    const row = await db.transaction((tx) => requestInvoice(tx, { type: "system", id: "billing" }, { orgId: s.orgId, kind: "subscription", title: `${s.product} · ${period}`, netEur: s.monthlyEur, subscriptionId: s.id, period }, now));
    if (row) n++;
  }
  return n;
}

/** Reminders by date: 3 days before, 1 day after, a week after (interest), two weeks after (pause warning, Javad told). */
export function reminderLevel(dueAt: Date, createdAt: Date, now: Date) {
  const d = (now.getTime() - dueAt.getTime()) / DAY;
  if (d >= 14) return 4;
  if (d >= 7) return 3;
  if (d >= 1) return 2;
  if (d >= -3 && now.getTime() - createdAt.getTime() > 2 * DAY) return 1;
  return 0;
}

export async function dunning(db: Db, now = new Date()) {
  const open = await db.select().from(invoices).where(eq(invoices.status, "requested"));
  let sent = 0;
  for (const i of open) {
    const level = reminderLevel(i.dueAt, i.createdAt, now);
    if (level <= i.reminderLevel) continue;
    await db.transaction(async (tx) => {
      await tx.update(invoices).set({ reminderLevel: level }).where(eq(invoices.id, i.id));
      await emit(tx, { type: "system", id: "dunning" }, "invoice.reminded", { type: "invoice", id: i.id }, { orgId: i.orgId, level, totalEur: i.totalEur, title: i.title, daysLate: Math.max(0, Math.floor((now.getTime() - i.dueAt.getTime()) / DAY)) });
    });
    sent++;
  }
  return sent;
}

/* ───────────── Paying by phone: EPC QR (SEPA credit transfer) ───────────── */

export function epcPayload(co: { legalName: string | null; iban: string | null; bic: string | null }, i: { totalEur: number; reference: string }) {
  if (!co.iban || !co.legalName) return null;
  return ["BCD", "002", "1", "SCT", co.bic ?? "", co.legalName.slice(0, 70), co.iban, `EUR${i.totalEur.toFixed(2)}`, "", "", i.reference].join("\n");
}

export async function qrSvg(payload: string) {
  return QRCode.toString(payload, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
}

/* ───────────── Reading ───────────── */

export async function invoicesFor(db: Db, orgId: string) {
  return db.select().from(invoices).where(eq(invoices.orgId, orgId)).orderBy(desc(invoices.createdAt));
}

export async function listInvoices(db: Db, now = new Date()) {
  const rows = await db.select({ invoice: invoices, company: organizations.name }).from(invoices).innerJoin(organizations, eq(organizations.id, invoices.orgId)).orderBy(desc(invoices.createdAt));
  const open = rows.filter((r) => r.invoice.status === "requested");
  const month = now.toISOString().slice(0, 7);
  return {
    rows,
    kpi: {
      openEur: round2(open.reduce((s, r) => s + r.invoice.totalEur, 0)),
      overdueEur: round2(open.filter((r) => r.invoice.dueAt < now).reduce((s, r) => s + r.invoice.totalEur, 0)),
      paidThisMonthEur: round2(rows.filter((r) => r.invoice.paidAt?.toISOString().slice(0, 7) === month).reduce((s, r) => s + r.invoice.netEur, 0)),
      waitingRegistration: rows.filter((r) => r.invoice.status === "paid").length,
    },
  };
}

/* ───────────── Partner payouts: one SEPA batch file for the bank ───────────── */

const xml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

/** Due payouts as a pain.001 file Javad uploads to the bank; partners without an IBAN are listed apart. */
export async function payoutBatch(db: Db, now = new Date()) {
  const co = await getCompany(db);
  const due = await db.select({ payout: payouts, partner: partners }).from(payouts).innerJoin(partners, eq(partners.id, payouts.partnerId)).where(and(eq(payouts.status, "due"), lte(payouts.dueAt, new Date(now.getTime() + 2 * DAY))));
  const ready = due.filter((d) => d.partner.iban);
  const missing = due.filter((d) => !d.partner.iban).map((d) => d.partner.name);
  if (!co?.iban || !co.legalName || !ready.length) return { xml: null, ids: [], missing, reason: !co?.iban ? "Add our IBAN in Finance › Company first" : "Nothing due with an IBAN" };
  const id = `LP-PAY-${now.toISOString().slice(0, 10)}-${randomBytes(2).toString("hex")}`;
  const sum = ready.reduce((s, d) => s + d.payout.amountEur, 0).toFixed(2);
  const tx = ready
    .map((d) => `<CdtTrfTxInf><PmtId><EndToEndId>${d.payout.id.slice(0, 35)}</EndToEndId></PmtId><Amt><InstdAmt Ccy="EUR">${d.payout.amountEur.toFixed(2)}</InstdAmt></Amt><Cdtr><Nm>${xml((d.partner.billingName ?? d.partner.name).slice(0, 70))}</Nm></Cdtr><CdtrAcct><Id><IBAN>${d.partner.iban}</IBAN></Id></CdtrAcct><RmtInf><Ustrd>${xml(`Compenso ${d.payout.id.slice(0, 8)}`)}</Ustrd></RmtInf></CdtTrfTxInf>`)
    .join("");
  const file = `<?xml version="1.0" encoding="UTF-8"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09"><CstmrCdtTrfInitn><GrpHdr><MsgId>${id}</MsgId><CreDtTm>${now.toISOString().slice(0, 19)}</CreDtTm><NbOfTxs>${ready.length}</NbOfTxs><CtrlSum>${sum}</CtrlSum><InitgPty><Nm>${xml(co.legalName)}</Nm></InitgPty></GrpHdr><PmtInf><PmtInfId>${id}</PmtInfId><PmtMtd>TRF</PmtMtd><NbOfTxs>${ready.length}</NbOfTxs><CtrlSum>${sum}</CtrlSum><PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl></PmtTpInf><ReqdExctnDt><Dt>${now.toISOString().slice(0, 10)}</Dt></ReqdExctnDt><Dbtr><Nm>${xml(co.legalName)}</Nm></Dbtr><DbtrAcct><Id><IBAN>${co.iban}</IBAN></Id></DbtrAcct>${co.bic ? `<DbtrAgt><FinInstnId><BICFI>${co.bic}</BICFI></FinInstnId></DbtrAgt>` : "<DbtrAgt><FinInstnId><Othr><Id>NOTPROVIDED</Id></Othr></FinInstnId></DbtrAgt>"}<ChrgBr>SLEV</ChrgBr>${tx}</PmtInf></CstmrCdtTrfInitn></Document>`;
  return { xml: file, ids: ready.map((d) => d.payout.id), missing, reason: null };
}

/** After the bank executed the batch: every payout in it is paid (partners are told). */
export async function markBatchPaid(db: Db, actor: Actor, ids: string[], now = new Date()) {
  for (const id of ids) await markPaid(db, actor, id, now).catch(() => null);
  return ids.length;
}

export const partnerIbanInput = z.object({ iban: z.string().trim().transform((s) => s.replace(/\s+/g, "").toUpperCase()).pipe(z.string().regex(ibanRe)), billingName: z.string().trim().min(2).max(140) });
