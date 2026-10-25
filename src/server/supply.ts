import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "@/db";
import { jobs, partners, supplyGaps } from "@/db/schema";
import type { Actor } from "./actor";
import { notFound } from "./errors";
import { audit, emit } from "./events";
import { queue } from "./notify";
import { skillLabel } from "./partner-rules";

/*
 * Supply gaps (gap audit 2026-10-25b): a job nobody can take is not only a red line for Javad. Ops-watch opens a
 * gap per missing skill and language with a ready recruiting post and earlier applicants who have the skill:
 * pending ones to decide, rejected ones to invite back. A partner with the skill starting closes the gap.
 */

const appUrl = () => (process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

/** Called by ops-watch for a job with no match; one open gap per skill and language. */
export async function recruitFor(db: Db, job: typeof jobs.$inferSelect) {
  const actor: Actor = { type: "system", id: "recruiting" };
  const skills = job.skills.length ? job.skills : ["industry"];
  const opened: string[] = [];
  for (const skill of skills) {
    await db.transaction(async (tx) => {
      const [had] = await tx
        .select({ id: supplyGaps.id })
        .from(supplyGaps)
        .where(and(eq(supplyGaps.status, "open"), eq(supplyGaps.skill, skill), job.language ? eq(supplyGaps.language, job.language) : sql`${supplyGaps.language} is null`));
      if (had) return;
      const known = await tx
        .select({ id: partners.id })
        .from(partners)
        .where(and(inArray(partners.status, ["applied", "rejected"]), sql`${skill} = any(${partners.skills})`, job.language ? sql`${job.language} = any(${partners.languages})` : undefined))
        .orderBy(desc(partners.createdAt))
        .limit(10);
      const [gap] = await tx.insert(supplyGaps).values({ skill, language: job.language, country: job.country, jobId: job.id, post: recruitingPost(skill, job.language, job.country), candidates: known.map((k) => k.id) }).returning();
      await emit(tx, actor, "supply.gap", { type: "supply_gap", id: gap.id }, { skill, language: job.language, country: job.country, job: job.title, candidates: known.length });
      await audit(tx, actor, "supply.gap", { type: "supply_gap", id: gap.id }, null, { skill, language: job.language, jobId: job.id });
      opened.push(gap.id);
    });
  }
  return opened;
}

/** The text Javad (or the posting agent later) puts on LinkedIn, job boards and partner communities. */
export function recruitingPost(skill: string, language: string | null, country: string | null) {
  const lang = language ? ` who works in ${({ it: "Italian", de: "German", en: "English", fa: "Persian" } as Record<string, string>)[language] ?? language}` : "";
  return [
    `We are looking for a partner for ${skillLabel(skill, "en")}${lang}${country ? ` (clients in ${country})` : ""}.`,
    "Clear tasks with a checklist, paid per accepted result, fast payouts (faster at higher levels), all work inside one portal, remote.",
    `Apply in two minutes: ${appUrl()}/en/partners`,
  ].join("\n");
}

/** Earlier applicants with the skill get one invitation to apply again (pending ones are simply decided). */
export async function inviteCandidates(db: Db, actor: Actor, gapId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const [g] = await tx.select().from(supplyGaps).where(eq(supplyGaps.id, gapId)).for("update");
    if (!g || g.status !== "open") throw notFound("gap");
    if (g.invitedAt) return 0;
    const people = g.candidates.length ? await tx.select().from(partners).where(and(inArray(partners.id, g.candidates), eq(partners.status, "rejected"))) : [];
    for (const p of people) await queue(tx, { audience: "partner", email: p.email, locale: p.locale, name: p.name, partnerId: p.id }, "recruitInvite", { skill: skillLabel(g.skill, p.locale), link: `${appUrl()}/${p.locale}/partners` });
    await tx.update(supplyGaps).set({ invitedAt: now }).where(eq(supplyGaps.id, g.id));
    await emit(tx, actor, "supply.invited", { type: "supply_gap", id: g.id }, { skill: g.skill, invited: people.length });
    await audit(tx, actor, "supply.invited", { type: "supply_gap", id: g.id }, null, { invited: people.map((p) => p.id) });
    return people.length;
  });
}

/** A partner starts (application accepted): every open gap of their skills and languages closes. */
export async function closeGapsFor(tx: DbOrTx, p: { skills: string[]; languages: string[] }, now = new Date()) {
  if (!p.skills.length) return;
  await tx
    .update(supplyGaps)
    .set({ status: "closed", closedAt: now })
    .where(and(eq(supplyGaps.status, "open"), inArray(supplyGaps.skill, p.skills), p.languages.length ? or(isNull(supplyGaps.language), inArray(supplyGaps.language, p.languages)) : isNull(supplyGaps.language)));
}

export async function closeGap(db: Db, actor: Actor, gapId: string, now = new Date()) {
  await db.transaction(async (tx) => {
    const [g] = await tx.update(supplyGaps).set({ status: "closed", closedAt: now }).where(and(eq(supplyGaps.id, gapId), eq(supplyGaps.status, "open"))).returning();
    if (!g) throw notFound("gap");
    await audit(tx, actor, "supply.closed", { type: "supply_gap", id: g.id }, { status: "open" }, { status: "closed" });
  });
}

export async function openGaps(db: DbOrTx) {
  const gaps = await db.select().from(supplyGaps).where(eq(supplyGaps.status, "open")).orderBy(desc(supplyGaps.createdAt));
  const ids = [...new Set(gaps.flatMap((g) => g.candidates))];
  const people = ids.length ? await db.select({ id: partners.id, name: partners.name, status: partners.status }).from(partners).where(inArray(partners.id, ids)) : [];
  return gaps.map((g) => ({ gap: g, candidates: people.filter((p) => g.candidates.includes(p.id)) }));
}
