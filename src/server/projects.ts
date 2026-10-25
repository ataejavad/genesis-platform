import { and, asc, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { judge, qaJudgeEnabled, verdictOf } from "@/agents/qa-judge";
import { ASSEMBLY_CHECKS, FIXED_RULES, inputText, PACKAGE_SEEDS, PROTOCOL_SEEDS } from "@/config/delivery-seeds";
import type { Db, DbOrTx, Tx } from "@/db";
import {
  changeRequests,
  complaints,
  contracts,
  type Criterion,
  customerApprovals,
  customerRequests,
  deliveries,
  jobOffers,
  jobs,
  memberships,
  milestones,
  orders,
  organizations,
  partners,
  projectCosts,
  projectInputs,
  projects,
  protocols,
  protocolVersions,
  qaReviews,
  servicePackages,
  user,
} from "@/db/schema";
import type { Actor } from "./actor";
import { runAgent } from "./agents";
import { customerCode, health, lessonsFrom, qaRoute, riskOf } from "./delivery-rules";
import { AppError, notFound } from "./errors";
import { putFile } from "./files";
import { audit, emit } from "./events";
import { addLesson, lessonsFor } from "./improve";
import { SKILLS } from "./partner-rules";
import { ALLOWED_FILES, MAX_FILE_BYTES, nameFromEmail, redact, TEXT_FILES } from "./redact";
import { levelFor, offerJob, reviewDelivery } from "./partners";
import { addSubscription, createCustomer } from "./portal";
import { orderLost, serviceJobDone } from "./service";

/*
 * Projects, protocols and QA (step 7, doc 15 §6د/§6د2). The whole company on one line:
 * order → project from a catalogue package → tasks offered to partners → delivery → QA → milestone the
 * customer accepts (invoiceable in step 8) → closing: monthly service starts, real margin, lessons.
 */

const by = (a: Actor) => `${a.type}:${a.id}`;
// what the customer reads on a milestone approval, in the project's language
const CHECK_IT: Record<string, string> = {
  en: "Ready. Please check it works as agreed and accept it, or tell us what to change.",
  it: "Pronto. Verificate che funzioni come concordato e accettatelo, oppure diteci cosa cambiare.",
  de: "Fertig. Bitte prüfen Sie, ob es wie vereinbart funktioniert, und nehmen Sie es ab, oder sagen Sie uns, was zu ändern ist.",
  fa: "آماده است. لطفاً بررسی کنید که طبق توافق کار می‌کند و تأییدش کنید، یا بگویید چه چیزی تغییر کند.",
};
const DAY = 864e5;

/* ───────────── Seeds: first protocols and packages (idempotent) ───────────── */

export async function seedDelivery(db: Db, actor: Actor = { type: "system", id: "seed" }) {
  await db.transaction(async (tx) => {
    for (const s of PROTOCOL_SEEDS) {
      let [p] = await tx.select().from(protocols).where(eq(protocols.code, s.code));
      if (p) continue;
      [p] = await tx.insert(protocols).values({ code: s.code, title: s.title, nace: s.nace ?? null, apqc: s.apqc }).returning();
      await tx.insert(protocolVersions).values({ protocolId: p.id, version: 1, status: "approved", goal: s.goal, inputs: s.inputs, deliverables: s.deliverables, rules: FIXED_RULES, criteria: s.criteria, guidance: s.guidance, standardDays: s.standardDays, createdBy: by(actor), approvedBy: by(actor), approvedAt: new Date(), changeNote: "first version" });
    }
    // package texts live in Git: names and milestone titles follow the seeds (prices too, until the catalogue is editable)
    for (const s of PACKAGE_SEEDS) await tx.insert(servicePackages).values(s).onConflictDoUpdate({ target: servicePackages.slug, set: { titles: s.titles, milestones: s.milestones, monthly: s.monthly } });
  });
}

/* ───────────── Protocol library ───────────── */

export async function approvedVersion(db: DbOrTx, code: string) {
  const [row] = await db
    .select({ version: protocolVersions, protocol: protocols })
    .from(protocolVersions)
    .innerJoin(protocols, eq(protocols.id, protocolVersions.protocolId))
    .where(and(eq(protocols.code, code), eq(protocolVersions.status, "approved")));
  return row ?? null;
}

export async function listProtocols(db: Db) {
  const [ps, vs, fails] = await Promise.all([
    db.select().from(protocols).orderBy(asc(protocols.code)),
    db.select().from(protocolVersions).orderBy(desc(protocolVersions.version)),
    failedCriteria(db),
  ]);
  return ps.map((p) => {
    const versions = vs.filter((v) => v.protocolId === p.id);
    return { protocol: p, approved: versions.find((v) => v.status === "approved") ?? null, drafts: versions.filter((v) => v.status === "draft"), versions, failures: fails.filter((f) => f.protocolId === p.id) };
  });
}

/** How often each criterion failed in QA (people's and the judge's reviews): where protocols need work. */
async function failedCriteria(db: Db) {
  const rows = await db
    .select({ results: qaReviews.results, by: qaReviews.by, criteria: protocolVersions.criteria, protocolId: protocolVersions.protocolId })
    .from(qaReviews)
    .innerJoin(deliveries, eq(deliveries.id, qaReviews.deliveryId))
    .innerJoin(jobs, eq(jobs.id, deliveries.jobId))
    .innerJoin(protocolVersions, eq(protocolVersions.id, jobs.protocolVersionId));
  const count = new Map<string, { protocolId: string; criterion: string; n: number }>();
  for (const r of rows)
    for (const x of r.results.filter((x) => x.result === "fail")) {
      const criterion = r.criteria[x.idx]?.text ?? `#${x.idx}`;
      const k = `${r.protocolId}|${criterion}`;
      count.set(k, { protocolId: r.protocolId, criterion, n: (count.get(k)?.n ?? 0) + 1 });
    }
  return [...count.values()].sort((a, b) => b.n - a.n);
}

const criterionInput = z.object({ text: z.string().trim().min(3).max(300), mandatory: z.boolean(), weight: z.number().int().min(1).max(5), method: z.enum(["auto", "judge", "human"]), texts: z.record(z.string(), z.string()).optional() });
export const versionInput = z.object({
  goal: z.string().trim().min(5).max(1000),
  inputs: z.array(z.string().trim().min(2).max(300)).max(20),
  deliverables: z.array(z.string().trim().min(2).max(300)).min(1).max(20),
  criteria: z.array(criterionInput).min(1).max(20),
  guidance: z.string().max(4000).optional(),
  standardDays: z.number().int().min(1).max(120),
  changeNote: z.string().trim().min(3).max(1000),
});

/** A new draft version (from Javad, the CEO or the improvement agent); nothing changes until it is approved. */
export async function draftVersion(db: Db, actor: Actor, protocolId: string, input: z.input<typeof versionInput>) {
  const v = versionInput.parse(input);
  return db.transaction(async (tx) => {
    const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(${protocolVersions.version}), 0)::int` }).from(protocolVersions).where(eq(protocolVersions.protocolId, protocolId));
    const [row] = await tx.insert(protocolVersions).values({ ...v, protocolId, version: max + 1, status: "draft", rules: FIXED_RULES, guidance: v.guidance ?? null, createdBy: by(actor) }).returning();
    await audit(tx, actor, "protocol.drafted", { type: "protocol_version", id: row.id }, null, { protocolId, version: row.version });
    return row;
  });
}

/** Javad approves: the draft becomes the version new projects use; running projects keep theirs. */
export async function approveVersion(db: Db, actor: Actor, versionId: string) {
  return db.transaction(async (tx) => {
    const [v] = await tx.select().from(protocolVersions).where(eq(protocolVersions.id, versionId));
    if (!v) throw notFound("protocol version");
    if (v.status !== "draft") throw new AppError(409, "not_draft", "only drafts can be approved");
    await tx.update(protocolVersions).set({ status: "retired" }).where(and(eq(protocolVersions.protocolId, v.protocolId), eq(protocolVersions.status, "approved")));
    await tx.update(protocolVersions).set({ status: "approved", approvedBy: by(actor), approvedAt: new Date() }).where(eq(protocolVersions.id, versionId));
    await emit(tx, actor, "protocol.approved", { type: "protocol_version", id: versionId }, { protocolId: v.protocolId, version: v.version });
    await audit(tx, actor, "protocol.approved", { type: "protocol_version", id: versionId }, { status: "draft" }, { status: "approved" });
  });
}

/* ───────────── Catalogue and orders ───────────── */

export async function listPackages(db: DbOrTx, all = false) {
  return db.select().from(servicePackages).where(all ? undefined : eq(servicePackages.active, true)).orderBy(asc(servicePackages.slug));
}

export const orderInput = z.object({
  packageSlug: z.string().min(2).max(60),
  source: z.enum(["market", "portal", "crm", "request", "cockpit"]),
  orgId: z.string().uuid().optional(),
  company: z.string().trim().min(2).max(200).optional(),
  email: z.string().trim().email().max(200).optional(),
  vat: z.string().trim().max(40).optional(),
  country: z.string().trim().length(2).optional(),
  industry: z.string().trim().max(40).optional(),
  locale: z.string().min(2).max(10).default("en"),
  note: z.string().max(2000).optional(),
});

/** Every way in ends as one order; a customer we know needs nothing else, a new one leaves company and email. */
export async function createOrder(db: Db, actor: Actor, input: z.input<typeof orderInput>) {
  const v = orderInput.parse(input);
  if (!v.orgId && (!v.company || !v.email)) throw new AppError(400, "invalid", "company and email needed");
  return db.transaction(async (tx) => {
    const [pkg] = await tx.select().from(servicePackages).where(and(eq(servicePackages.slug, v.packageSlug), eq(servicePackages.active, true)));
    if (!pkg) throw notFound("package");
    const [row] = await tx.insert(orders).values({ ...v, country: v.country?.toUpperCase() }).returning();
    await emit(tx, actor, "order.created", { type: "order", id: row.id }, { package: pkg.title, source: v.source, company: v.company ?? null, orgId: v.orgId ?? null, setupEur: pkg.setupEur, monthlyEur: pkg.monthlyEur });
    await audit(tx, actor, "order.created", { type: "order", id: row.id }, null, v);
    return row;
  });
}

/** Orders before their project starts: new, contract sent, signed (deposit requested). */
export async function listOrders(db: Db, statuses = ["new", "contract", "signed"]) {
  return db.select({ order: orders, company: organizations.name }).from(orders).leftJoin(organizations, eq(organizations.id, orders.orgId)).where(inArray(orders.status, statuses)).orderBy(desc(orders.createdAt));
}

/** One click: the customer account (if new) and the project from the package; tasks go out as offers. */
/**
 * Signed contract and paid deposit (step 8 gate): the project starts and its tasks go to partners. Called by
 * finance when the deposit is paid, or by the contract module when there is nothing to pay first.
 */
export async function convertOrder(db: Db, actor: Actor, orderId: string, now = new Date()) {
  const { projectId, password } = await db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!o) throw notFound("order");
    if (o.status !== "signed") throw new AppError(409, "not_signed", o.status === "new" || o.status === "contract" ? "the contract is not signed yet" : "order already handled");
    let orgId = o.orgId;
    let password = "";
    if (!orgId) {
      const c = await createCustomer(tx, actor, { name: o.company!, country: o.country ?? "IT", industry: o.industry ?? "other", locale: o.locale, email: o.email!, contactName: o.company! });
      orgId = c.org.id;
      password = c.password;
    }
    const p = await insertProject(tx, actor, { orgId, packageSlug: o.packageSlug, orderId, now });
    await tx.update(orders).set({ status: "converted", projectId: p.id, orgId }).where(eq(orders.id, orderId));
    await audit(tx, actor, "order.converted", { type: "order", id: orderId }, { status: "signed" }, { status: "converted", projectId: p.id });
    return { projectId: p.id, password };
  });
  await offerTasks(db, actor, projectId);
  return { projectId, password };
}

export async function rejectOrder(db: Db, actor: Actor, orderId: string, note: string, reason = "other") {
  await db.transaction(async (tx) => {
    const [o] = await tx.update(orders).set({ status: "rejected", note: note.slice(0, 2000) }).where(and(eq(orders.id, orderId), inArray(orders.status, ["new", "contract"]))).returning();
    if (!o) throw notFound("order");
    // why we lost it: three of the same reason in 30 days become a sales lesson
    await orderLost(tx, actor, orderId, reason);
    if (o.contractId) await tx.update(contracts).set({ status: "cancelled" }).where(and(eq(contracts.id, o.contractId), eq(contracts.status, "sent")));
    await audit(tx, actor, "order.rejected", { type: "order", id: orderId }, { status: "new" }, { status: "rejected", note, reason });
  });
}

/* ───────────── Projects ───────────── */

export const projectInput = z.object({ orgId: z.string().uuid().nullable(), packageSlug: z.string().min(2), sensitiveData: z.boolean().default(false), language: z.string().max(5).optional() });

export async function createProject(db: Db, actor: Actor, input: z.input<typeof projectInput>, now = new Date()) {
  const v = projectInput.parse(input);
  const p = await db.transaction((tx) => insertProject(tx, actor, { ...v, now }));
  await offerTasks(db, actor, p.id);
  return p;
}

async function insertProject(tx: Tx, actor: Actor, v: { orgId: string | null; packageSlug: string; orderId?: string; sensitiveData?: boolean; language?: string; now: Date }) {
  const [pkg] = await tx.select().from(servicePackages).where(eq(servicePackages.slug, v.packageSlug));
  if (!pkg) throw notFound("package");
  const org = v.orgId ? (await tx.select().from(organizations).where(eq(organizations.id, v.orgId)))[0] : null;
  if (v.orgId && !org) throw notFound("customer");
  const lang = v.language ?? org?.locale ?? "en";
  // every task needs an approved protocol: no protocol, no sale
  const versions = new Map<string, NonNullable<Awaited<ReturnType<typeof approvedVersion>>>>();
  for (const t of pkg.tasks) {
    const a = await approvedVersion(tx, t.protocol);
    if (!a) throw new AppError(409, "no_protocol", `no approved protocol ${t.protocol}`);
    versions.set(t.protocol, a);
  }
  const risk = riskOf({ priceEur: pkg.setupEur, fromPackage: true, sensitiveData: v.sensitiveData });
  const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(projects);
  // tasks of later milestones start after earlier ones end
  let day = 0;
  const due = pkg.tasks.map((t) => (day += t.days));
  const [project] = await tx
    .insert(projects)
    .values({
      code: `P-${1001 + n}`, orgId: v.orgId, title: pkg.titles[lang] ?? pkg.title, packageSlug: pkg.slug, kind: v.orgId ? "customer" : "internal", risk: risk.level, riskWhy: risk.why,
      priceEur: pkg.setupEur, monthlyEur: pkg.monthlyEur, budgetEur: pkg.tasks.reduce((s, t) => s + t.payEur, 0), language: lang, country: org?.country ?? null, orderId: v.orderId ?? null,
      startedAt: v.now, dueAt: new Date(v.now.getTime() + day * DAY), createdBy: by(actor),
    })
    .returning();
  let left = pkg.setupEur;
  const ms = [];
  for (const [seq, m] of pkg.milestones.entries()) {
    const amount = seq === pkg.milestones.length - 1 ? left : Math.round((pkg.setupEur * m.sharePct) / 100);
    left -= amount;
    // the customer's countdown: the last task of this milestone; later milestones wait for their payment
    const days = Math.max(0, ...pkg.tasks.map((t, i) => ((t.milestone ?? 0) === seq ? due[i] : 0))) || day;
    const [row] = await tx.insert(milestones).values({ projectId: project.id, orgId: v.orgId, seq, title: m.titles?.[lang] ?? m.title, amountEur: amount, status: seq === 0 ? "open" : "planned", dueAt: new Date(v.now.getTime() + days * DAY) }).returning();
    ms.push(row);
  }
  for (const [i, t] of pkg.tasks.entries()) {
    const pv = versions.get(t.protocol)!.version;
    const brief = [t.brief, "", `Goal: ${pv.goal}`, `Deliver: ${pv.deliverables.join("; ")}`, `Rules: ${pv.rules.join(" ")}`, pv.guidance ? `How we usually do it (advice; you choose your method): ${pv.guidance}` : ""].filter((x) => x !== null).join("\n").trim();
    await tx.insert(jobs).values({
      title: t.title, brief, kind: v.orgId ? "customer" : "internal", customerOrgId: v.orgId, customerCode: org ? customerCode(org.id, org.industry, org.country) : null,
      skills: t.skills.filter((s) => SKILLS.some((k) => k.id === s)), language: lang, country: org?.country ?? null, personalData: pkg.personalData, payEur: t.payEur,
      dueAt: new Date(v.now.getTime() + due[i] * DAY), checklist: pv.criteria.map((c) => c.texts?.[lang] ?? c.text), status: (t.milestone ?? 0) > 0 && ms[t.milestone] ? "held" : "open",
      projectId: project.id, milestoneId: ms[t.milestone]?.id ?? ms[0].id, protocolVersionId: pv.id, createdBy: by(actor),
    });
  }
  await emit(tx, actor, "project.created", { type: "project", id: project.id }, { code: project.code, title: project.title, orgId: v.orgId, risk: risk.level, priceEur: project.priceEur });
  await audit(tx, actor, "project.created", { type: "project", id: project.id }, null, { package: pkg.slug, orgId: v.orgId, risk });
  return project;
}

/** Open tasks (the milestones already paid) go to the best-matching partners (the assignment agent's job). */
async function offerTasks(db: Db, actor: Actor, projectId: string) {
  const open = await db.select().from(jobs).where(and(eq(jobs.projectId, projectId), eq(jobs.status, "open")));
  for (const j of open) await offerJob(db, actor, j.id);
}

async function projectRows(db: Db, ids?: string[]) {
  const ps = await db.select({ project: projects, company: organizations.name }).from(projects).leftJoin(organizations, eq(organizations.id, projects.orgId)).where(ids ? inArray(projects.id, ids) : undefined).orderBy(desc(projects.createdAt));
  if (!ps.length) return [];
  const pids = ps.map((p) => p.project.id);
  const [ts, ms, cs] = await Promise.all([
    db.select().from(jobs).where(inArray(jobs.projectId, pids)),
    db.select().from(milestones).where(inArray(milestones.projectId, pids)).orderBy(asc(milestones.seq)),
    db.select().from(projectCosts).where(inArray(projectCosts.projectId, pids)),
  ]);
  return ps.map(({ project: p, company }) => {
    const tasks = ts.filter((t) => t.projectId === p.id);
    const mss = ms.filter((m) => m.projectId === p.id);
    const costs = cs.filter((c) => c.projectId === p.id);
    const costEur = costs.reduce((s, c) => s + c.amountEur, 0);
    return { project: p, company, tasks, milestones: mss, costs, costEur, health: health({ priceEur: p.priceEur, budgetEur: p.budgetEur, costEur, tasks, waiting: mss.filter((m) => m.status === "ready"), now: new Date() }) };
  });
}

/** Cockpit list with the two numbers that keep us from becoming an agency: catalogue share and margin. */
export async function listProjects(db: Db) {
  const rows = await projectRows(db);
  const fromCatalogue = rows.filter((r) => r.project.packageSlug).length;
  const closed = rows.filter((r) => r.project.status === "closed");
  const margin = closed.length ? closed.reduce((s, r) => s + (r.project.priceEur - r.costEur) / (r.project.priceEur || 1), 0) / closed.length : null;
  return { rows, kpi: { cataloguePct: rows.length ? fromCatalogue / rows.length : null, avgMarginPct: margin, running: rows.filter((r) => r.project.status === "running").length, flagged: rows.filter((r) => r.project.status === "running" && r.health.flags.length).length } };
}

export async function projectDetail(db: Db, id: string) {
  const [row] = await projectRows(db, [id]);
  if (!row) throw notFound("project");
  const ids = row.tasks.map((t) => t.id);
  const [dels, crs, partnerRows, pvs] = await Promise.all([
    ids.length ? db.select().from(deliveries).where(inArray(deliveries.jobId, ids)).orderBy(desc(deliveries.version)) : [],
    db.select().from(changeRequests).where(eq(changeRequests.projectId, id)).orderBy(desc(changeRequests.createdAt)),
    db.select({ id: partners.id, name: partners.name }).from(partners),
    db.select({ id: protocolVersions.id, version: protocolVersions.version, code: protocols.code }).from(protocolVersions).innerJoin(protocols, eq(protocols.id, protocolVersions.protocolId)),
  ]);
  return {
    ...row,
    tasks: row.tasks.map((t) => ({ job: t, partner: partnerRows.find((p) => p.id === t.partnerId)?.name ?? null, last: dels.find((d) => d.jobId === t.id) ?? null, protocol: pvs.find((v) => v.id === t.protocolVersionId) ?? null })),
    changes: crs,
  };
}

/** What the customer sees: progress and milestones, never partners or costs. */
export async function customerProjects(db: Db, orgId: string) {
  const rows = await projectRows(db, (await db.select({ id: projects.id }).from(projects).where(eq(projects.orgId, orgId))).map((r) => r.id));
  return rows.map((r) => ({
    id: r.project.id, code: r.project.code, title: r.project.title, status: r.project.status, dueAt: r.project.dueAt.toISOString().slice(0, 10), progress: r.health.progress, monthlyEur: r.project.monthlyEur,
    milestones: r.milestones.map((m) => ({ title: m.title, status: m.status, amountEur: m.amountEur, dueAt: m.dueAt?.toISOString().slice(0, 10) ?? null, rating: m.rating })),
  }));
}

/* ───────────── Hooks: delivery accepted, customer decided ───────────── */

/** Called in the same transaction as an accepted delivery: cost booked; a finished milestone goes to the customer. */
export async function onJobAccepted(tx: Tx, actor: Actor, job: typeof jobs.$inferSelect, now: Date) {
  // a monthly check-up of a subscription: its real cost, and the customer hears it is done
  if (job.subscriptionId) return serviceJobDone(tx, actor, job, now);
  if (!job.projectId) return;
  await tx.insert(projectCosts).values({ projectId: job.projectId, kind: "partner", amountEur: job.payEur, jobId: job.id, note: job.title }).onConflictDoNothing();
  if (!job.milestoneId || job.role === "qa") return;
  const [m] = await tx.select().from(milestones).where(eq(milestones.id, job.milestoneId)).for("update");
  if (!m || !["open", "changes"].includes(m.status)) return;
  const [{ open }] = await tx.select({ open: sql<number>`count(*)::int` }).from(jobs).where(and(eq(jobs.milestoneId, m.id), sql`${jobs.status} not in ('accepted', 'paid', 'cancelled')`, sql`${jobs.id} <> ${job.id}`));
  if (open > 0) return;
  // several partners made parts of this milestone: one assembler (a person, a company or an agent) makes one hand-over first
  if (job.role === "work") {
    const works = await tx.select().from(jobs).where(and(eq(jobs.milestoneId, m.id), eq(jobs.role, "work"), sql`${jobs.status} <> 'cancelled'`));
    if (works.length >= 2) {
      await openAssembly(tx, actor, m, works, now);
      return;
    }
  }
  const [p] = await tx.select().from(projects).where(eq(projects.id, job.projectId));
  if (!p.orgId) {
    // internal work: nobody outside to ask
    await acceptMilestone(tx, actor, m, p, now);
    return;
  }
  const [a] = await tx
    .insert(customerApprovals)
    .values({ orgId: p.orgId, title: `${p.title}: ${m.title}`, detail: `${p.code} · ${(CHECK_IT[p.language] ?? CHECK_IT.en)}`, milestoneId: m.id, createdBy: by(actor) })
    .returning();
  await tx.update(milestones).set({ status: "ready", readyAt: now, approvalId: a.id, reminders: 0, remindedAt: null }).where(eq(milestones.id, m.id));
  await emit(tx, actor, "customer_approval.requested", { type: "customer_approval", id: a.id }, { orgId: p.orgId, title: a.title });
  await emit(tx, actor, "milestone.ready", { type: "milestone", id: m.id }, { projectId: p.id, code: p.code, title: m.title });
  await audit(tx, actor, "milestone.ready", { type: "milestone", id: m.id }, { status: m.status }, { status: "ready", approvalId: a.id });
}

async function openAssembly(tx: Tx, actor: Actor, m: typeof milestones.$inferSelect, works: (typeof jobs.$inferSelect)[], now: Date) {
  const [p] = await tx.select().from(projects).where(eq(projects.id, m.projectId));
  const dels = await tx.select().from(deliveries).where(and(inArray(deliveries.jobId, works.map((w) => w.id)), eq(deliveries.status, "accepted"))).orderBy(desc(deliveries.version));
  const parts = works.map((w) => {
    const d = dels.find((x) => x.jobId === w.id);
    return `- ${w.title}: ${d?.link ?? "?"}${d?.note ? ` (${d.note})` : ""}`;
  });
  const payEur = Math.max(40, Math.round(works.reduce((s, w) => s + w.payEur, 0) * 0.1));
  const first = works[0];
  const [a] = await tx
    .insert(jobs)
    .values({
      title: `Assemble: ${m.title}`, brief: [`Put these parts together into one hand-over for the milestone "${m.title}".`, "", ...parts, "", `Rules: ${FIXED_RULES.join(" ")}`].join("\n"),
      kind: first.kind, customerOrgId: first.customerOrgId, customerCode: first.customerCode, skills: ["assembly"], language: first.language, country: first.country, personalData: first.personalData,
      payEur, dueAt: new Date(now.getTime() + 2 * DAY), checklist: ASSEMBLY_CHECKS[p.language] ?? ASSEMBLY_CHECKS.en, projectId: p.id, milestoneId: m.id, role: "assemble", createdBy: by(actor),
    })
    .returning();
  await tx.update(projects).set({ budgetEur: p.budgetEur + payEur }).where(eq(projects.id, p.id));
  await emit(tx, actor, "job.opened", { type: "job", id: a.id }, { projectId: p.id, code: p.code, role: "assemble", title: a.title });
  await audit(tx, actor, "job.opened", { type: "job", id: a.id }, null, { role: "assemble", parts: works.length, payEur });
}

async function acceptMilestone(tx: Tx, actor: Actor, m: typeof milestones.$inferSelect, p: typeof projects.$inferSelect, now: Date, acceptedBy = p.orgId ? "customer" : "internal") {
  await tx.update(milestones).set({ status: "accepted", acceptedAt: now, acceptedBy }).where(eq(milestones.id, m.id));
  // a complaint about this milestone ends when the customer (or the silence rule) accepts the fixed work
  await tx.update(complaints).set({ status: "resolved", resolvedAt: now, resolvedBy: `milestone:${acceptedBy}` }).where(and(eq(complaints.milestoneId, m.id), eq(complaints.status, "open")));
  // invoiceable now: step 8 (contracts and finance) turns this event into the invoice of this milestone
  await emit(tx, actor, "milestone.accepted", { type: "milestone", id: m.id }, { projectId: p.id, code: p.code, orgId: p.orgId, title: m.title, amountEur: m.amountEur });
  await audit(tx, actor, "milestone.accepted", { type: "milestone", id: m.id }, { status: m.status }, { status: "accepted" });
  const [{ left }] = await tx.select({ left: sql<number>`count(*)::int` }).from(milestones).where(and(eq(milestones.projectId, p.id), sql`${milestones.status} <> 'accepted'`, sql`${milestones.id} <> ${m.id}`));
  // a complaint can reopen a milestone of a closed project: it is not closed (and billed monthly) twice
  if (left === 0 && p.status !== "closed") await closeProject(tx, actor, p, now);
}

/** Called in the same transaction as the customer's decision on an approval. */
export async function onApprovalDecided(tx: Tx, actor: Actor, a: typeof customerApprovals.$inferSelect, decision: "approved" | "changes", now = new Date(), rating?: { stars: number; note?: string }) {
  if (a.milestoneId) {
    const [m] = await tx.select().from(milestones).where(eq(milestones.id, a.milestoneId));
    const [p] = await tx.select().from(projects).where(eq(projects.id, m.projectId));
    if (decision === "approved") {
      if (rating) await rateMilestone(tx, actor, m, p, rating.stars, rating.note);
      await acceptMilestone(tx, actor, m, p, now);
    } else await askForChanges(tx, actor, m, p, a.note ?? "", now);
  }
  if (a.changeRequestId) {
    const [cr] = await tx.select().from(changeRequests).where(eq(changeRequests.id, a.changeRequestId));
    await tx.update(changeRequests).set({ status: decision === "approved" ? "approved" : "rejected" }).where(eq(changeRequests.id, cr.id));
    if (decision === "approved") {
      const [p] = await tx.select().from(projects).where(eq(projects.id, cr.projectId));
      const [{ seq }] = await tx.select({ seq: sql<number>`coalesce(max(${milestones.seq}), -1)::int + 1` }).from(milestones).where(eq(milestones.projectId, p.id));
      // paid before it starts, like every milestone (billed by finance once the earlier ones are accepted)
      await tx.insert(milestones).values({ projectId: p.id, orgId: p.orgId, seq, title: `Change: ${cr.text.slice(0, 80)}`, amountEur: cr.priceEur, status: "planned", dueAt: new Date(Math.max(now.getTime(), p.dueAt.getTime()) + cr.days * DAY) });
      await tx.update(projects).set({ priceEur: p.priceEur + cr.priceEur, dueAt: new Date(p.dueAt.getTime() + cr.days * DAY), status: "running" }).where(eq(projects.id, p.id));
    }
    await emit(tx, actor, "change_request.decided", { type: "change_request", id: cr.id }, { projectId: cr.projectId, decision, orgId: cr.orgId });
  }
}

/* ───────────── Changes, rework and ratings (marketplace lessons 2026-10-25) ───────────── */

const REWORK_DAYS = 3;
// what the customer reads when the included rounds of changes are used up
const OVER_CAP: Record<string, string> = {
  en: "The {n} rounds of changes included in this step are used. We send you a price for this change within 24 hours; you can still accept the step as it is.",
  it: "I {n} giri di modifiche inclusi in questa fase sono stati usati. Vi mandiamo un prezzo per questa modifica entro 24 ore; potete comunque accettare la fase così com'è.",
  de: "Die {n} enthaltenen Änderungsrunden dieser Phase sind aufgebraucht. Wir senden Ihnen binnen 24 Stunden einen Preis für diese Änderung; Sie können die Phase auch so abnehmen.",
  fa: "{n} دور اصلاحِ این مرحله استفاده شده است. ظرف ۲۴ ساعت برای این تغییر قیمت می‌فرستیم؛ می‌توانید همین مرحله را همان‌طور که هست تأیید کنید.",
};

/** The customer's 1-5 after a hand-over; a low one reaches Javad at once (partners never see who rated). */
async function rateMilestone(tx: Tx, actor: Actor, m: typeof milestones.$inferSelect, p: typeof projects.$inferSelect, stars: number, note?: string) {
  const rating = Math.max(1, Math.min(5, Math.round(stars)));
  await tx.update(milestones).set({ rating, ratingNote: note?.trim().slice(0, 500) || null }).where(eq(milestones.id, m.id));
  await emit(tx, actor, "milestone.rated", { type: "milestone", id: m.id }, { projectId: p.id, code: p.code, title: m.title, orgId: p.orgId, rating, note: note ?? null });
  await audit(tx, actor, "milestone.rated", { type: "milestone", id: m.id }, null, { rating, note });
}

/** "Ask for changes": within the included rounds the last maker reworks it for free; beyond them it is priced first. */
async function askForChanges(tx: Tx, actor: Actor, m: typeof milestones.$inferSelect, p: typeof projects.$inferSelect, note: string, now: Date) {
  const [pkg] = p.packageSlug ? await tx.select({ revisions: servicePackages.revisions }).from(servicePackages).where(eq(servicePackages.slug, p.packageSlug)) : [];
  const cap = pkg?.revisions ?? 2;
  if (m.revisions >= cap && p.orgId) {
    const [req] = await tx.insert(customerRequests).values({ orgId: p.orgId, kind: "change", text: `${p.code} ${m.title}: ${note || "more changes"}`.slice(0, 4000), dueAt: new Date(now.getTime() + DAY) }).returning();
    const [a] = await tx.insert(customerApprovals).values({ orgId: p.orgId, title: `${p.title}: ${m.title}`, detail: `${p.code} · ${(OVER_CAP[p.language] ?? OVER_CAP.en).replace("{n}", String(cap))}`, milestoneId: m.id, createdBy: by(actor) }).returning();
    await tx.update(milestones).set({ approvalId: a.id, readyAt: now, reminders: 0, remindedAt: null }).where(eq(milestones.id, m.id));
    await emit(tx, actor, "milestone.revision_cap", { type: "milestone", id: m.id }, { projectId: p.id, code: p.code, title: m.title, cap, note, requestId: req.id });
    await audit(tx, actor, "milestone.revision_cap", { type: "milestone", id: m.id }, { revisions: m.revisions }, { requestId: req.id });
    return;
  }
  await tx.update(milestones).set({ status: "changes", revisions: m.revisions + 1 }).where(eq(milestones.id, m.id));
  const job = await reworkJob(tx, actor, m, p, note, "revision", now);
  await emit(tx, actor, "milestone.changes", { type: "milestone", id: m.id }, { projectId: p.id, code: p.code, title: m.title, note, round: m.revisions + 1, cap, jobId: job?.id ?? null });
}

/**
 * New work on a milestone the customer is not happy with. revision/fix: the partner who made the last version redoes
 * it at no extra pay (included in the job); swap: a copy goes to other partners (we pay again, the customer does not).
 */
export async function reworkJob(tx: Tx, actor: Actor, m: typeof milestones.$inferSelect, p: typeof projects.$inferSelect, note: string, kind: "revision" | "fix" | "swap", now = new Date()) {
  const done = await tx.select().from(jobs).where(and(eq(jobs.milestoneId, m.id), inArray(jobs.role, ["work", "assemble", "revision"]), inArray(jobs.status, ["accepted", "paid", "delivered", "assigned"]))).orderBy(desc(jobs.createdAt));
  const src = done.find((j) => j.role === "assemble") ?? done[0];
  if (!src) return null;
  // whoever is still working on an earlier fix stops: the newest request wins
  await tx.update(jobs).set({ status: "cancelled" }).where(and(eq(jobs.milestoneId, m.id), eq(jobs.role, "revision"), inArray(jobs.status, ["open", "offered", "assigned"])));
  const same = kind !== "swap" && src.partnerId;
  const label = kind === "swap" ? "Redo" : "Changes";
  const [j] = await tx
    .insert(jobs)
    .values({
      title: `${label}: ${src.title.replace(/^(Changes|Redo): /, "")}`, brief: [`The customer asked for this ${kind === "swap" ? "to be redone by someone new" : "to be changed"}:`, note || "(no details: see the checklist)", "", "Original brief:", src.brief].join("\n"),
      kind: src.kind, customerOrgId: src.customerOrgId, customerCode: src.customerCode, skills: src.skills, language: src.language, country: src.country, personalData: src.personalData,
      payEur: same ? 0 : src.payEur, dueAt: new Date(now.getTime() + (same ? REWORK_DAYS : REWORK_DAYS * 2) * DAY), checklist: src.checklist, projectId: p.id, milestoneId: m.id, protocolVersionId: src.protocolVersionId,
      role: "revision", status: same ? "assigned" : "open", partnerId: same ? src.partnerId : null, createdBy: by(actor),
    })
    .returning();
  if (!same) {
    // the partner being replaced is never offered the redo
    if (src.partnerId) await tx.insert(jobOffers).values({ jobId: j.id, partnerId: src.partnerId, fit: 0, why: [{ factor: "replaced", points: 0, max: 0 }], status: "withdrawn" }).onConflictDoNothing();
    await tx.update(projects).set({ budgetEur: p.budgetEur + src.payEur }).where(eq(projects.id, p.id));
    await emit(tx, actor, "job.opened", { type: "job", id: j.id }, { projectId: p.id, code: p.code, role: "revision", title: j.title });
  } else await emit(tx, actor, "job.rework", { type: "job", id: j.id }, { partnerId: src.partnerId, title: j.title, note, projectId: p.id, code: p.code });
  await audit(tx, actor, "job.rework", { type: "job", id: j.id }, null, { kind, from: src.id, partnerId: same ? src.partnerId : null });
  return j;
}

/* ───────────── Pay before each milestone ───────────── */

/**
 * A paid (or free) milestone starts: its held tasks open and go to partners. When the payment came later than
 * planned, the dates of this and every later milestone move by the wait, so nobody is "late" for our waiting.
 */
export async function startMilestone(db: Db, actor: Actor, milestoneId: string, now = new Date()) {
  const projectId = await db.transaction(async (tx) => {
    const [m] = await tx.select().from(milestones).where(eq(milestones.id, milestoneId)).for("update");
    if (!m || !["planned", "unpaid"].includes(m.status)) return null;
    const [prev] = await tx.select().from(milestones).where(and(eq(milestones.projectId, m.projectId), eq(milestones.seq, m.seq - 1)));
    const shift = Math.max(0, Math.round((now.getTime() - (prev?.dueAt ?? now).getTime()) / 1000));
    if (shift > 0) {
      const by_ = `${shift} seconds`;
      await tx.update(jobs).set({ dueAt: sql`${jobs.dueAt} + ${by_}::interval` }).where(and(eq(jobs.projectId, m.projectId), eq(jobs.status, "held")));
      await tx.update(milestones).set({ dueAt: sql`${milestones.dueAt} + ${by_}::interval` }).where(and(eq(milestones.projectId, m.projectId), sql`${milestones.seq} >= ${m.seq}`, sql`${milestones.status} <> 'accepted'`));
      await tx.update(projects).set({ dueAt: sql`${projects.dueAt} + ${by_}::interval` }).where(eq(projects.id, m.projectId));
    }
    await tx.update(milestones).set({ status: "open" }).where(eq(milestones.id, m.id));
    await tx.update(jobs).set({ status: "open" }).where(and(eq(jobs.milestoneId, m.id), eq(jobs.status, "held")));
    await emit(tx, actor, "milestone.started", { type: "milestone", id: m.id }, { projectId: m.projectId, title: m.title, orgId: m.orgId, shiftDays: Math.round(shift / 86400) });
    await audit(tx, actor, "milestone.started", { type: "milestone", id: m.id }, { status: m.status }, { status: "open", shiftSeconds: shift });
    return m.projectId;
  });
  if (projectId) await offerTasks(db, actor, projectId);
  return projectId;
}

/** All milestones accepted: the monthly service starts, real margin and lessons are recorded. */
async function closeProject(tx: Tx, actor: Actor, p: typeof projects.$inferSelect, now: Date) {
  const tasks = await tx.select().from(jobs).where(eq(jobs.projectId, p.id));
  const ids = tasks.map((t) => t.id);
  const dels = ids.length ? await tx.select().from(deliveries).where(inArray(deliveries.jobId, ids)) : [];
  const reviews = dels.length ? await tx.select().from(qaReviews).where(inArray(qaReviews.deliveryId, dels.map((d) => d.id))) : [];
  const pvs = await tx.select({ id: protocolVersions.id, criteria: protocolVersions.criteria, code: protocols.code }).from(protocolVersions).innerJoin(protocols, eq(protocols.id, protocolVersions.protocolId));
  const failures = reviews.flatMap((r) => {
    const job = tasks.find((t) => t.id === dels.find((d) => d.id === r.deliveryId)?.jobId);
    const pv = pvs.find((v) => v.id === job?.protocolVersionId);
    return r.results.filter((x) => x.result === "fail").map((x) => ({ protocol: pv?.code ?? "?", criterion: (pv?.criteria as Criterion[] | undefined)?.[x.idx]?.text ?? `#${x.idx}` }));
  });
  const late = dels.filter((d) => d.status === "accepted" && d.onTime === false).length;
  const [{ cost }] = await tx.select({ cost: sql<number>`coalesce(sum(${projectCosts.amountEur}), 0)::int` }).from(projectCosts).where(eq(projectCosts.projectId, p.id));
  const learned = lessonsFrom(failures, late);
  await tx.update(projects).set({ status: "closed", closedAt: now, lessons: learned }).where(eq(projects.id, p.id));
  // the same lessons go to the shared store that estimates, protocols and the QA judge read (improvement loop)
  for (const text of learned) await addLesson(tx, { area: "delivery", text: `${p.code}: ${text}`, source: `project:${p.id}` });
  if (p.orgId && p.monthlyEur > 0 && p.packageSlug) {
    const [pkg] = await tx.select({ plan: servicePackages.plan }).from(servicePackages).where(eq(servicePackages.slug, p.packageSlug));
    await addSubscription(tx, actor, p.orgId, p.packageSlug, pkg?.plan ?? "Standard", p.monthlyEur, now);
  }
  await emit(tx, actor, "project.closed", { type: "project", id: p.id }, { code: p.code, priceEur: p.priceEur, costEur: cost, marginPct: p.priceEur ? Math.round(((p.priceEur - cost) / p.priceEur) * 100) : null });
  await audit(tx, actor, "project.closed", { type: "project", id: p.id }, { status: p.status }, { status: "closed", costEur: cost });
}

/* ───────────── Change requests (scope changes are priced before any work) ───────────── */

export async function quoteChange(db: Db, actor: Actor, projectId: string, text: string, priceEur: number, days: number) {
  const v = z.object({ text: z.string().trim().min(3).max(2000), priceEur: z.number().int().min(0).max(100000), days: z.number().int().min(0).max(365) }).parse({ text, priceEur, days });
  return db.transaction(async (tx) => {
    const [p] = await tx.select().from(projects).where(eq(projects.id, projectId));
    if (!p) throw notFound("project");
    if (!p.orgId) throw new AppError(400, "internal", "internal projects need no customer approval");
    const [cr] = await tx.insert(changeRequests).values({ projectId, orgId: p.orgId, text: v.text, priceEur: v.priceEur, days: v.days, createdBy: by(actor) }).returning();
    const [a] = await tx.insert(customerApprovals).values({ orgId: p.orgId, title: `${p.title}: change`, detail: `${v.text}\n+€${v.priceEur} · +${v.days} days`, changeRequestId: cr.id, createdBy: by(actor) }).returning();
    await tx.update(changeRequests).set({ approvalId: a.id }).where(eq(changeRequests.id, cr.id));
    await emit(tx, actor, "customer_approval.requested", { type: "customer_approval", id: a.id }, { orgId: p.orgId, title: a.title });
    await emit(tx, actor, "change_request.quoted", { type: "change_request", id: cr.id }, { projectId, code: p.code, priceEur: v.priceEur, days: v.days });
    await audit(tx, actor, "change_request.quoted", { type: "change_request", id: cr.id }, null, v);
    return cr;
  });
}

/* ───────────── QA ───────────── */

async function deliveryContext(db: DbOrTx, deliveryId: string) {
  const [row] = await db
    .select({ delivery: deliveries, job: jobs, version: protocolVersions, project: projects })
    .from(deliveries)
    .innerJoin(jobs, eq(jobs.id, deliveries.jobId))
    .leftJoin(protocolVersions, eq(protocolVersions.id, jobs.protocolVersionId))
    .leftJoin(projects, eq(projects.id, jobs.projectId))
    .where(eq(deliveries.id, deliveryId));
  if (!row) throw notFound("delivery");
  return row;
}

/**
 * After a partner delivers (worker, on delivery.submitted). Who checks depends on the project: our judge (when the
 * key is set; a person when unsure), a QA partner (a QA company or agent, never the maker), or always a person.
 * Then the delivery is accepted automatically (low risk, trusted partner, not sampled) or waits in the QA queue.
 */
export async function afterDelivery(db: Db, deliveryId: string, sample = Math.random()) {
  const ctx = await deliveryContext(db, deliveryId);
  if (ctx.delivery.status !== "submitted") return { route: "done" as const, why: "already reviewed" };
  if (ctx.job.role === "qa") return qaReportIn(db, ctx, sample);
  const qaBy = ctx.project?.qaBy ?? "judge";
  if (qaBy === "partner" && ctx.version && ctx.project) {
    await openQaJob(db, ctx);
    return { route: "qa-partner" as const, why: "a QA partner checks it first" };
  }
  const actor: Actor = { type: "system", id: "qa-judge" };
  let judged: { verdict: "accept" | "changes" | "review" } | null = null;
  if (qaBy === "judge" && ctx.version && qaJudgeEnabled()) {
    try {
      const v = ctx.version;
      const learned = (await lessonsFor(db, "delivery", 5)).map((l) => l.text);
      const results = await runAgent(db, "qa-judge", "judge", () => judge({ lessons: learned, goal: v.goal, rules: v.rules, criteria: v.criteria, selfCheck: ctx.delivery.selfCheck, link: ctx.delivery.link, note: ctx.delivery.note }), { deliveryId });
      const verdict = verdictOf(ctx.version.criteria, results);
      await db.transaction(async (tx) => {
        await tx.insert(qaReviews).values({ deliveryId, by: "judge", results, verdict });
        await emit(tx, actor, "qa.judged", { type: "delivery", id: deliveryId }, { jobId: ctx.job.id, verdict });
      });
      judged = { verdict };
    } catch (err) {
      console.error("QA judge failed; a person reviews", err);
    }
  }
  return routeDelivery(db, ctx, judged, sample, actor);
}

async function routeDelivery(db: Db, ctx: Awaited<ReturnType<typeof deliveryContext>>, judged: { verdict: "accept" | "changes" | "review" } | null, sample: number, actor: Actor) {
  const [{ last }] = ctx.job.milestoneId ? await db.select({ last: sql<boolean>`${milestones.seq} = (select max(m2.seq) from milestones m2 where m2.project_id = ${milestones.projectId})` }).from(milestones).where(eq(milestones.id, ctx.job.milestoneId)) : [{ last: false }];
  const tier = (await levelFor(db, ctx.delivery.partnerId)).tier.id;
  const r = qaRoute({ risk: (ctx.project?.risk as "low" | "medium" | "high" | undefined) ?? null, judge: judged, partnerTier: tier, lastMilestone: Boolean(last), sample });
  if (r.route === "auto") await reviewDelivery(db, actor, ctx.delivery.id, true, 4, "Accepted by QA (all mandatory criteria passed).");
  return r;
}

/** A QA job for a QA partner: the criteria as their checklist, the delivery link in the brief. */
async function openQaJob(db: Db, ctx: Awaited<ReturnType<typeof deliveryContext>>) {
  const v = ctx.version!;
  const p = ctx.project!;
  const actor: Actor = { type: "system", id: "qa-router" };
  await db.transaction(async (tx) => {
    const payEur = Math.max(20, Math.round(ctx.job.payEur * 0.15));
    const brief = [
      "Check this delivery against the criteria. Tick a criterion only when it passes; explain every failure in your note.",
      "", `Work: ${ctx.job.title} (v${ctx.delivery.version})`, `Delivery: ${ctx.delivery.link}`, ctx.delivery.note ? `Note from the maker: ${ctx.delivery.note}` : "", `Goal: ${v.goal}`, `Rules: ${v.rules.join(" ")}`,
    ].filter(Boolean).join("\n");
    const [q] = await tx
      .insert(jobs)
      .values({
        title: `QA: ${ctx.job.title}`, brief, kind: ctx.job.kind, customerOrgId: ctx.job.customerOrgId, customerCode: ctx.job.customerCode, skills: ["qa"], language: ctx.job.language, country: ctx.job.country,
        personalData: ctx.job.personalData, payEur, dueAt: new Date(Date.now() + 2 * DAY), checklist: v.criteria.map((c) => c.texts?.[p.language] ?? c.text), projectId: p.id, protocolVersionId: v.id,
        role: "qa", reviewsDeliveryId: ctx.delivery.id, createdBy: by(actor),
      })
      .returning();
    await tx.update(projects).set({ budgetEur: sql`${projects.budgetEur} + ${payEur}` }).where(eq(projects.id, p.id));
    await emit(tx, actor, "job.opened", { type: "job", id: q.id }, { projectId: p.id, code: p.code, role: "qa", title: q.title });
    await audit(tx, actor, "job.opened", { type: "job", id: q.id }, null, { role: "qa", reviews: ctx.delivery.id, payEur });
  });
}

/** The QA partner delivered their check: it counts like the judge's, then the checked work is routed as usual. */
async function qaReportIn(db: Db, ctx: Awaited<ReturnType<typeof deliveryContext>>, sample: number) {
  const actor: Actor = { type: "system", id: "qa-router" };
  const target = ctx.job.reviewsDeliveryId;
  const criteria = ctx.version?.criteria ?? [];
  const results = criteria.map((_, idx) => ({ idx, result: (ctx.delivery.selfCheck[idx] ? "pass" : "fail") as "pass" | "fail", ...(ctx.delivery.selfCheck[idx] ? {} : { note: ctx.delivery.note ?? undefined }) }));
  const verdict = verdictOf(criteria, results);
  if (target)
    await db.transaction(async (tx) => {
      await tx.insert(qaReviews).values({ deliveryId: target, by: `partner:${ctx.delivery.partnerId}`, results, verdict });
      await emit(tx, actor, "qa.judged", { type: "delivery", id: target }, { jobId: ctx.job.id, verdict, by: "partner" });
    });
  // the QA work itself is done once the report is in (its quality shows later in judge agreement)
  await reviewDelivery(db, actor, ctx.delivery.id, true, 4, "QA report received.");
  if (!target) return { route: "done" as const, why: "QA job without a delivery" };
  const checked = await deliveryContext(db, target);
  if (checked.delivery.status !== "submitted") return { route: "done" as const, why: "already reviewed" };
  return routeDelivery(db, checked, { verdict }, sample, actor);
}

/** Deliveries waiting for a person, with the judge's view per criterion when there is one. */
export async function qaQueue(db: Db) {
  const rows = await db
    .select({ delivery: deliveries, job: jobs, version: protocolVersions, project: projects, partner: partners.name, code: protocols.code })
    .from(deliveries)
    .innerJoin(jobs, eq(jobs.id, deliveries.jobId))
    .innerJoin(partners, eq(partners.id, deliveries.partnerId))
    .leftJoin(protocolVersions, eq(protocolVersions.id, jobs.protocolVersionId))
    .leftJoin(protocols, eq(protocols.id, protocolVersions.protocolId))
    .leftJoin(projects, eq(projects.id, jobs.projectId))
    .where(eq(deliveries.status, "submitted"))
    .orderBy(asc(deliveries.createdAt));
  const ids = rows.map((r) => r.delivery.id);
  // the judge's or a QA partner's view, newest first
  const reviews = ids.length ? await db.select().from(qaReviews).where(and(inArray(qaReviews.deliveryId, ids), sql`${qaReviews.by} not like 'user:%'`)).orderBy(desc(qaReviews.createdAt)) : [];
  return rows.map((r) => ({ ...r, judge: reviews.find((x) => x.deliveryId === r.delivery.id) ?? null }));
}

/** A person's QA decision, per criterion; stored next to the judge's so we can measure agreement. */
export async function humanReview(db: Db, actor: Actor, deliveryId: string, results: { idx: number; result: "pass" | "fail" }[], quality: number, note: string) {
  const ctx = await deliveryContext(db, deliveryId);
  const criteria: Criterion[] = ctx.version?.criteria ?? ctx.job.checklist.map((text) => ({ text, mandatory: true, weight: 1, method: "human" as const }));
  const verdict = verdictOf(criteria, results) === "changes" ? "changes" : "accept";
  await db.insert(qaReviews).values({ deliveryId, by: by(actor), results, verdict });
  return reviewDelivery(db, actor, deliveryId, verdict === "accept", quality, note);
}

/** How often the judge agreed with a person on the same delivery (target ≥ 80% before it decides alone more). */
export async function judgeAgreement(db: Db) {
  const rows = await db.select().from(qaReviews);
  const byDelivery = new Map<string, typeof rows>();
  for (const r of rows) byDelivery.set(r.deliveryId, [...(byDelivery.get(r.deliveryId) ?? []), r]);
  let both = 0;
  let agree = 0;
  for (const rs of byDelivery.values()) {
    const j = rs.find((r) => r.by === "judge");
    const h = rs.find((r) => r.by.startsWith("user:"));
    if (!j || !h || j.verdict === "review") continue;
    both++;
    if (j.verdict === h.verdict) agree++;
  }
  return { compared: both, agreement: both ? agree / both : null };
}

/* ───────────── Delivery watchdog (worker, hourly) ───────────── */

/** Reminders after 1, 3 and 6 days of silence; on day 7 the milestone counts as accepted (contract clause "deemed acceptance"). */
export const SILENCE = { remindDays: [1, 3, 6], autoAcceptDays: 7 };

/** Milestones waiting on the customer get reminders, then are accepted on their own after 7 silent days; late tasks are counted. */
export async function deliveryWatch(db: Db, now = new Date()) {
  const actor: Actor = { type: "system", id: "delivery-watchdog" };
  const waiting = await db
    .select({ m: milestones, p: projects, company: organizations.name })
    .from(milestones)
    .innerJoin(projects, eq(projects.id, milestones.projectId))
    .leftJoin(organizations, eq(organizations.id, milestones.orgId))
    .where(and(eq(milestones.status, "ready"), lt(milestones.readyAt, new Date(now.getTime() - DAY))));
  let reminded = 0;
  let autoAccepted = 0;
  for (const w of waiting) {
    const days = (now.getTime() - w.m.readyAt!.getTime()) / DAY;
    const autoOn = new Date(w.m.readyAt!.getTime() + SILENCE.autoAcceptDays * DAY);
    if (days >= SILENCE.autoAcceptDays && w.m.reminders >= SILENCE.remindDays.length) {
      await db.transaction(async (tx) => {
        const [m] = await tx.select().from(milestones).where(eq(milestones.id, w.m.id)).for("update");
        if (m.status !== "ready") return;
        if (m.approvalId) await tx.update(customerApprovals).set({ status: "approved", note: "accepted after 7 days without an answer", decidedBy: "system:auto-accept", decidedAt: now }).where(and(eq(customerApprovals.id, m.approvalId), eq(customerApprovals.status, "pending")));
        await acceptMilestone(tx, actor, m, w.p, now, "auto");
        await emit(tx, actor, "milestone.auto_accepted", { type: "milestone", id: m.id }, { orgId: m.orgId, code: w.p.code, title: `${w.p.title}: ${m.title}`, company: w.company });
      });
      autoAccepted++;
      continue;
    }
    // the next reminder is due when its day has come (missed ones are not sent twice)
    const due = SILENCE.remindDays.filter((d) => days >= d).length;
    if (due <= w.m.reminders) continue;
    await db.transaction(async (tx) => {
      await tx.update(milestones).set({ remindedAt: now, reminders: due }).where(eq(milestones.id, w.m.id));
      await emit(tx, actor, "milestone.reminded", { type: "milestone", id: w.m.id }, { orgId: w.m.orgId, code: w.p.code, title: `${w.p.title}: ${w.m.title}`, company: w.company, waitingHours: Math.round(days * 24), reminder: due, autoOn: autoOn.toISOString() });
    });
    reminded++;
  }
  const late = await db.select({ id: jobs.id }).from(jobs).where(and(sql`${jobs.projectId} is not null`, inArray(jobs.status, ["open", "offered", "assigned"]), lt(jobs.dueAt, now)));
  return { reminded, autoAccepted, lateTasks: late.length };
}

/* ───────────── Customer material: intake, identity removed, shared with the project's partners ───────────── */

/** What the protocols of a project ask from the customer, minus what they already gave. */
async function needsOf(db: DbOrTx, projectId: string) {
  const vs = await db.select({ inputs: protocolVersions.inputs }).from(jobs).innerJoin(protocolVersions, eq(protocolVersions.id, jobs.protocolVersionId)).where(and(eq(jobs.projectId, projectId), eq(jobs.role, "work")));
  const given = new Set((await db.select({ label: projectInputs.label }).from(projectInputs).where(and(eq(projectInputs.projectId, projectId), sql`${projectInputs.status} <> 'withheld'`))).map((r) => r.label));
  return [...new Set(vs.flatMap((v) => v.inputs))].filter((l) => !given.has(l));
}

export const projectNeeds = (db: Db, projectId: string) => needsOf(db, projectId);

/** Running projects of a customer with what we still need from them, in their language. */
export async function customerNeeds(db: Db, orgId: string, lang: string) {
  const ps = await db.select().from(projects).where(and(eq(projects.orgId, orgId), eq(projects.status, "running"))).orderBy(asc(projects.createdAt));
  const out = [];
  for (const p of ps) {
    const needs = await needsOf(db, p.id);
    if (needs.length) out.push({ projectId: p.id, code: p.code, title: p.title, needs: needs.map((label) => ({ label, text: inputText(label, lang) })) });
  }
  return out;
}

/** The customer's names we hide from partners: the company and its people. */
async function identityOf(db: DbOrTx, orgId: string | null) {
  if (!orgId) return { company: [], people: [] };
  const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, orgId));
  const people = await db.select({ name: user.name, email: user.email }).from(memberships).innerJoin(user, eq(user.id, memberships.userId)).where(eq(memberships.orgId, orgId));
  const names = people.flatMap((u) => [u.name, nameFromEmail(u.email)]).filter((n): n is string => Boolean(n) && !n!.includes("@") && n !== org?.name);
  return { company: org ? [org.name] : [], people: names };
}

export const inputInput = z.object({
  projectId: z.string().uuid(),
  label: z.string().trim().min(2).max(200),
  source: z.enum(["chat", "meeting", "file"]),
  text: z.string().trim().max(20000).optional(),
  file: z.object({ name: z.string().max(200), type: z.string().max(200), bytes: z.custom<Uint8Array>((b) => b instanceof Uint8Array) }).optional(),
});

/**
 * Saves what the customer (or we, from a meeting) gave. Text and text files are cleaned and shared with the
 * project's partners at once; PDFs, images and office files wait until a person has looked (Cockpit › project).
 * `orgId` is set when the customer gives it: the project must be theirs.
 */
export async function addInput(db: Db, actor: Actor, input: z.input<typeof inputInput>, orgId?: string) {
  const v = inputInput.parse(input);
  if (!v.text && !v.file) throw new AppError(400, "empty", "nothing to save");
  const [p] = await db.select().from(projects).where(eq(projects.id, v.projectId));
  if (!p || (orgId && p.orgId !== orgId)) throw notFound("project");
  const known = await identityOf(db, p.orgId);
  let text = v.text ?? null;
  let fileKey: string | null = null;
  let status = "shared";
  if (v.file) {
    if (!ALLOWED_FILES.includes(v.file.type)) throw new AppError(400, "file_type", "this kind of file is not accepted");
    if (v.file.bytes.byteLength > MAX_FILE_BYTES) throw new AppError(400, "file_size", "file too large (10 MB max)");
    fileKey = await putFile(v.file.bytes);
    if (TEXT_FILES.includes(v.file.type)) text = [text, new TextDecoder().decode(v.file.bytes)].filter(Boolean).join("\n\n");
    else status = "check";
  }
  const cleaned = text ? redact(text, known) : null;
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(projectInputs)
      .values({ projectId: p.id, orgId: p.orgId, label: v.label, source: v.source, text, cleanText: cleaned?.clean ?? null, removed: cleaned?.removed ?? [], fileName: v.file?.name ?? null, fileType: v.file?.type ?? null, fileSize: v.file?.bytes.byteLength ?? null, fileKey, status, createdBy: by(actor) })
      .returning();
    await emit(tx, actor, "project_input.added", { type: "project_input", id: row.id }, { projectId: p.id, code: p.code, label: v.label, source: v.source, status, file: v.file?.name ?? null });
    await audit(tx, actor, "project_input.added", { type: "project_input", id: row.id }, null, { projectId: p.id, label: v.label, source: v.source, status, removed: row.removed });
    return row;
  });
}

/** A person looked at a file: partners may see it now, or never. */
export async function decideInput(db: Db, actor: Actor, id: string, share: boolean) {
  return db.transaction(async (tx) => {
    const [row] = await tx.update(projectInputs).set({ status: share ? "shared" : "withheld", decidedBy: by(actor) }).where(eq(projectInputs.id, id)).returning();
    if (!row) throw notFound("input");
    await emit(tx, actor, "project_input.decided", { type: "project_input", id }, { projectId: row.projectId, shared: share });
    await audit(tx, actor, "project_input.decided", { type: "project_input", id }, null, { status: row.status });
    return row;
  });
}

export async function projectInputsFor(db: Db, projectId: string) {
  return db.select().from(projectInputs).where(eq(projectInputs.projectId, projectId)).orderBy(asc(projectInputs.createdAt));
}

/** What a partner of the project sees: cleaned text, and files a person cleared. Never the raw text. */
export async function partnerMaterials(db: DbOrTx, projectId: string) {
  const rows = await db.select().from(projectInputs).where(and(eq(projectInputs.projectId, projectId), eq(projectInputs.status, "shared"))).orderBy(asc(projectInputs.createdAt));
  return rows.map((r) => ({ id: r.id, label: r.label, text: r.cleanText, file: r.fileKey && !TEXT_FILES.includes(r.fileType ?? "") ? { name: r.fileName, url: `/api/files/${r.id}` } : null }));
}

/** May this partner open this input's file? Only a partner working on the project now, and only once cleared. */
export async function partnerMayOpen(db: Db, partnerId: string, inputId: string) {
  const [row] = await db.select().from(projectInputs).where(eq(projectInputs.id, inputId));
  if (!row || row.status !== "shared" || !row.fileKey || TEXT_FILES.includes(row.fileType ?? "")) return null;
  const [j] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.projectId, row.projectId), eq(jobs.partnerId, partnerId), inArray(jobs.status, ["assigned", "delivered"])));
  return j ? row : null;
}

export async function setQaBy(db: Db, actor: Actor, projectId: string, qaBy: "judge" | "partner" | "us") {
  await db.transaction(async (tx) => {
    const [p] = await tx.select().from(projects).where(eq(projects.id, projectId));
    if (!p) throw notFound("project");
    await tx.update(projects).set({ qaBy }).where(eq(projects.id, projectId));
    await audit(tx, actor, "project.qa_by", { type: "project", id: projectId }, { qaBy: p.qaBy }, { qaBy });
  });
}
