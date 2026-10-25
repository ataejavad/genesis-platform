import { createHash } from "node:crypto";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { EXPERIMENT_SEEDS } from "@/config/experiments";
import type { Db, DbOrTx } from "@/db";
import { experiments, experimentSubjects, lessons } from "@/db/schema";
import type { Actor } from "./actor";
import { AppError, notFound } from "./errors";
import { audit, emit } from "./events";

/*
 * Improvement loop (principle 2): goal metric → experiment → measure → adopt + store lesson.
 * Subjects (a prospect, a check-up, …) get a variant by a stable hash, outcomes are recorded where they happen,
 * and a daily job tests the arms once each has its minimum sample. Javad adopts; the lesson is kept and read by
 * the agents of that area. Guardrails are for "must not get worse" (opt-outs, complaints), never for quality.
 */

const DAY = 864e5;
const by = (a: Actor) => `${a.type}:${a.id}`;

type Experiment = typeof experiments.$inferSelect;

/** Creates the experiments defined in Git that do not exist yet (daily job). */
export async function ensureExperiments(db: Db) {
  for (const e of EXPERIMENT_SEEDS) await db.insert(experiments).values({ ...e, createdBy: "system:seed" }).onConflictDoNothing();
}

export async function startExperiment(db: Db, actor: Actor, v: { key: string; area: string; hypothesis: string; metric: string; guardrail?: string; variants: { id: string; description: string }[]; minSample?: number; windowDays?: number }) {
  if (v.variants.length < 2) throw new AppError(400, "invalid", "an experiment needs a control and at least one variant");
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(experiments).values({ ...v, createdBy: by(actor) }).returning();
    await audit(tx, actor, "experiment.started", { type: "experiment", id: row.id }, null, { key: v.key });
    return row;
  });
}

const pick = (e: Experiment, subjectId: string) => {
  const h = createHash("sha256").update(`${e.key}:${subjectId}`).digest().readUInt32BE(0);
  return e.variants[h % e.variants.length].id;
};

/**
 * The variant for this subject. Running: assigned once and remembered. Decided: the winner for everyone
 * (or the control when nothing won). No experiment: null, the caller keeps its default.
 */
export async function variantFor(db: DbOrTx, key: string, subjectId: string) {
  const [e] = await db.select().from(experiments).where(eq(experiments.key, key));
  if (!e) return null;
  if (e.status !== "running") return e.winner ?? e.variants[0].id;
  const variant = pick(e, subjectId);
  await db.insert(experimentSubjects).values({ experimentId: e.id, subjectId, variant }).onConflictDoNothing();
  const [s] = await db.select({ v: experimentSubjects.variant }).from(experimentSubjects).where(and(eq(experimentSubjects.experimentId, e.id), eq(experimentSubjects.subjectId, subjectId)));
  return s.v;
}

/** The outcome for a subject, where it happens (a reply, an opt-out, an unlock). Only the first success counts. */
export async function recordOutcome(db: DbOrTx, key: string, subjectId: string, o: { success?: boolean; guardrailHit?: boolean }, now = new Date()) {
  const [e] = await db.select({ id: experiments.id }).from(experiments).where(eq(experiments.key, key));
  if (!e) return;
  const set = { ...(o.success !== undefined ? { success: o.success, outcomeAt: now } : {}), ...(o.guardrailHit ? { guardrailHit: true } : {}) };
  if (!Object.keys(set).length) return;
  await db.update(experimentSubjects).set(set).where(and(eq(experimentSubjects.experimentId, e.id), eq(experimentSubjects.subjectId, subjectId), ...(o.success !== undefined ? [isNull(experimentSubjects.success)] : [])));
}

/* ───────────── Measuring ───────────── */

export type Arm = { id: string; description: string; n: number; successes: number; rate: number; guardrailRate: number };

/** Two-proportion z-test of a variant against the control (one-sided: is it better?). */
export function zScore(control: Arm, v: Arm) {
  const p = (control.successes + v.successes) / (control.n + v.n);
  const se = Math.sqrt(p * (1 - p) * (1 / control.n + 1 / v.n));
  return se ? (v.rate - control.rate) / se : 0;
}

/** Adopt a variant only if it beats the control (p < 0.05 one-sided) and its guardrail is not worse by > 2 points. */
export function verdict(arms: Arm[]) {
  const [control, ...rest] = arms;
  const better = rest
    .map((v) => ({ v, z: zScore(control, v) }))
    .filter(({ v, z }) => z >= 1.645 && v.guardrailRate <= control.guardrailRate + 0.02)
    .sort((a, b) => b.v.rate - a.v.rate)[0];
  return better ? { winner: better.v.id, z: Math.round(better.z * 100) / 100, why: `${better.v.description}: ${pct(better.v.rate)} vs ${pct(control.rate)} (n ${better.v.n}/${control.n})` } : { winner: control.id, z: null, why: `No variant beat the control (${arms.map((a) => `${a.id} ${pct(a.rate)} n${a.n}`).join(", ")})` };
}
const pct = (r: number) => `${Math.round(r * 1000) / 10}%`;

export async function armsOf(db: DbOrTx, e: Experiment, now = new Date()): Promise<Arm[]> {
  const subs = await db.select().from(experimentSubjects).where(eq(experimentSubjects.experimentId, e.id));
  const closed = (s: (typeof subs)[number]) => s.success !== null || now.getTime() - s.assignedAt.getTime() > e.windowDays * DAY;
  return e.variants.map((v) => {
    const mine = subs.filter((s) => s.variant === v.id && closed(s));
    const successes = mine.filter((s) => s.success).length;
    return { id: v.id, description: v.description, n: mine.length, successes, rate: mine.length ? successes / mine.length : 0, guardrailRate: mine.length ? mine.filter((s) => s.guardrailHit).length / mine.length : 0 };
  });
}

/** Daily: subjects past their window without success count as failures; experiments with enough data become "ready". */
export async function checkExperiments(db: Db, now = new Date()) {
  await ensureExperiments(db);
  const ready: string[] = [];
  for (const e of await db.select().from(experiments).where(eq(experiments.status, "running"))) {
    await db.update(experimentSubjects).set({ success: false, outcomeAt: now }).where(and(eq(experimentSubjects.experimentId, e.id), isNull(experimentSubjects.success), lt(experimentSubjects.assignedAt, new Date(now.getTime() - e.windowDays * DAY))));
    const arms = await armsOf(db, e, now);
    if (arms.some((a) => a.n < e.minSample)) continue;
    const v = verdict(arms);
    await db.transaction(async (tx) => {
      await tx.update(experiments).set({ status: "ready", result: { arms, ...v } }).where(eq(experiments.id, e.id));
      await emit(tx, { type: "system", id: "experiments" }, "experiment.ready", { type: "experiment", id: e.id }, { key: e.key, area: e.area, recommended: v.winner, why: v.why });
    });
    ready.push(e.key);
  }
  return ready;
}

/** Javad's decision. Adopted or not, what was learned is stored as a lesson for the agents of that area. */
export async function decideExperiment(db: Db, actor: Actor, id: string, adopt: boolean, note?: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const [e] = await tx.select().from(experiments).where(eq(experiments.id, id)).for("update");
    if (!e) throw notFound("experiment");
    if (!["ready", "running"].includes(e.status)) throw new AppError(409, "already_decided", "already decided");
    const arms = await armsOf(tx, e, now);
    const v = verdict(arms);
    const winner = adopt ? v.winner : e.variants[0].id;
    const status = adopt ? "adopted" : e.status === "running" ? "stopped" : "rejected";
    await tx.update(experiments).set({ status, winner, result: { arms, ...v, note: note ?? null }, decidedBy: by(actor), decidedAt: now }).where(eq(experiments.id, id));
    const w = e.variants.find((x) => x.id === winner)!;
    const text = adopt && winner !== e.variants[0].id ? `${e.metric}: "${w.description}" works better. ${v.why}.` : `${e.metric}: keep "${e.variants[0].description}". ${v.why}.`;
    await tx.insert(lessons).values({ area: e.area, text: note ? `${text} ${note}` : text, source: `experiment:${e.id}`, evidence: { arms } });
    await emit(tx, actor, "experiment.decided", { type: "experiment", id }, { key: e.key, status, winner });
    await audit(tx, actor, "experiment.decided", { type: "experiment", id }, { status: e.status }, { status, winner });
    return { status, winner };
  });
}

/* ───────────── Lessons ───────────── */

export async function addLesson(db: DbOrTx, v: { area: string; text: string; source: string; evidence?: Record<string, unknown> }) {
  const [row] = await db.insert(lessons).values({ ...v, text: v.text.slice(0, 1000), evidence: v.evidence ?? {} }).returning();
  return row;
}

/** What agents of an area should know (newest first); goes into their instructions. */
export async function lessonsFor(db: DbOrTx, area: string, limit = 10) {
  return db.select().from(lessons).where(and(eq(lessons.area, area), eq(lessons.active, true))).orderBy(desc(lessons.createdAt)).limit(limit);
}

export async function setLessonActive(db: Db, actor: Actor, id: string, active: boolean) {
  await db.transaction(async (tx) => {
    await tx.update(lessons).set({ active }).where(eq(lessons.id, id));
    await audit(tx, actor, "lesson.updated", { type: "lesson", id }, null, { active });
  });
}

export async function listExperiments(db: Db, now = new Date()) {
  const rows = await db.select().from(experiments).orderBy(desc(experiments.createdAt));
  return Promise.all(rows.map(async (e) => ({ ...e, arms: await armsOf(db, e, now) })));
}

export async function listLessons(db: Db, limit = 50) {
  return db.select().from(lessons).orderBy(desc(lessons.createdAt)).limit(limit);
}
