import { and, desc, eq, max } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { approvals, contentItems, contentRevisions } from "@/db/schema";
import { LOCALES } from "@/config/locales";
import { type Actor, actorRef } from "./actor";
import { conflict, forbidden, notFound } from "./errors";
import { audit, emit } from "./events";
import { addLesson } from "./improve";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

export const draftInput = z.object({
  locale: z.enum(Object.keys(LOCALES) as [keyof typeof LOCALES, ...(keyof typeof LOCALES)[]]),
  slug: z.string().max(200).regex(slugPattern, "lowercase words separated by - and /"),
  type: z.enum(["page", "article", "industry-hub", "solution"]).default("page"),
  title: z.string().min(1).max(200),
  summary: z.string().max(500).optional(),
  body: z.string().min(1).max(200_000),
  marketId: z.uuid().optional(),
});
export type DraftInput = z.infer<typeof draftInput>;

/**
 * Proposes new text for a page. Never changes what is live: the live text stays on
 * content_items until a human approves the new revision (doc 15 §6).
 */
export async function createDraft(db: Db, actor: Actor, raw: unknown, opts: { allowedMarketId?: string | null } = {}) {
  const input = draftInput.parse(raw);
  if (opts.allowedMarketId && input.marketId !== opts.allowedMarketId) {
    throw forbidden("this key may only write drafts for its own market");
  }
  const by = actorRef(actor);

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(contentItems)
      .where(and(eq(contentItems.locale, input.locale), eq(contentItems.slug, input.slug)))
      .for("update");

    let item = existing;
    let version = 1;
    if (item) {
      // Agents re-send whole pages on every run; an identical proposal is not a new revision.
      const [last] = await tx
        .select({ version: contentRevisions.version, title: contentRevisions.title, summary: contentRevisions.summary, body: contentRevisions.body })
        .from(contentRevisions)
        .where(eq(contentRevisions.contentId, item.id))
        .orderBy(desc(contentRevisions.version))
        .limit(1);
      if (last && last.body === input.body && last.title === input.title && (last.summary ?? undefined) === input.summary) {
        return { contentId: item.id, version: last.version, approvalId: null, unchanged: true };
      }
    }
    if (!item) {
      [item] = await tx
        .insert(contentItems)
        .values({ ...input, status: "pending", version: 1, createdBy: by })
        .returning();
    } else {
      const [{ latest }] = await tx
        .select({ latest: max(contentRevisions.version) })
        .from(contentRevisions)
        .where(eq(contentRevisions.contentId, item.id));
      version = (latest ?? 0) + 1;
      if (item.status !== "published") {
        // Not live yet, so the item itself can carry the newest proposal.
        [item] = await tx
          .update(contentItems)
          .set({ ...input, status: "pending", version })
          .where(eq(contentItems.id, item.id))
          .returning();
      }
    }

    await tx.insert(contentRevisions).values({
      contentId: item.id,
      version,
      title: input.title,
      summary: input.summary,
      body: input.body,
      actor: by,
    });

    // Older pending proposals for the same page are superseded by this one.
    await tx
      .update(approvals)
      .set({ status: "rejected", decidedBy: "system:supersede", decidedAt: new Date(), note: `superseded by v${version}` })
      .where(and(eq(approvals.subjectId, item.id), eq(approvals.status, "pending")));

    const [approval] = await tx
      .insert(approvals)
      .values({
        subjectType: "content",
        subjectId: item.id,
        subjectVersion: version,
        title: `${input.locale}/${input.slug}: ${input.title}`,
        summary: input.summary ?? input.body.slice(0, 280),
        requestedBy: by,
      })
      .returning();

    await emit(tx, actor, "approval.requested", { type: "approval", id: approval.id }, {
      contentId: item.id,
      version,
      locale: input.locale,
      slug: input.slug,
      title: approval.title,
      summary: approval.summary,
    });
    await audit(tx, actor, "content.draft", { type: "content", id: item.id }, null, { version, title: input.title });

    return { contentId: item.id, version, approvalId: approval.id as string | null, unchanged: false };
  });
}

export async function decideApproval(
  db: Db,
  actor: Actor,
  approvalId: string,
  decision: "approved" | "rejected",
  note?: string,
) {
  return db.transaction(async (tx) => {
    const [approval] = await tx.select().from(approvals).where(eq(approvals.id, approvalId)).for("update");
    if (!approval) throw notFound("approval");
    if (approval.status !== "pending") throw conflict(`approval is already ${approval.status}`);

    const [decided] = await tx
      .update(approvals)
      .set({ status: decision, decidedBy: actorRef(actor), decidedAt: new Date(), note })
      .where(eq(approvals.id, approvalId))
      .returning();

    const [item] = await tx.select().from(contentItems).where(eq(contentItems.id, approval.subjectId)).for("update");
    if (!item) throw notFound("content");

    let updated = item;
    if (decision === "approved") {
      const [rev] = await tx
        .select()
        .from(contentRevisions)
        .where(and(eq(contentRevisions.contentId, item.id), eq(contentRevisions.version, approval.subjectVersion)));
      if (!rev) throw notFound("revision");
      [updated] = await tx
        .update(contentItems)
        .set({
          title: rev.title,
          summary: rev.summary,
          body: rev.body,
          version: rev.version,
          status: "published",
          publishedAt: new Date(),
        })
        .where(eq(contentItems.id, item.id))
        .returning();
      await emit(tx, actor, "content.published", { type: "content", id: item.id }, {
        locale: item.locale,
        slug: item.slug,
        version: rev.version,
      });
    } else if (item.status !== "published") {
      [updated] = await tx.update(contentItems).set({ status: "rejected" }).where(eq(contentItems.id, item.id)).returning();
      await emit(tx, actor, "content.rejected", { type: "content", id: item.id }, { locale: item.locale, slug: item.slug, note: note ?? null });
      // Javad's reason is a lesson the writing agents read next time (improvement loop)
      if (note?.trim()) await addLesson(tx, { area: "content", text: `Rejected ${item.slug} (${item.locale}): ${note.trim()}`, source: `rejection:${item.id}` });
    }

    await emit(tx, actor, "approval.decided", { type: "approval", id: approvalId }, { decision, note: note ?? null });
    await audit(
      tx,
      actor,
      `approval.${decision}`,
      { type: "content", id: item.id },
      { status: item.status, version: item.version },
      { status: updated.status, version: updated.version },
    );

    return { approval: decided, content: updated };
  });
}

export async function getPublished(db: Db, locale: string, slug: string) {
  const [item] = await db
    .select()
    .from(contentItems)
    .where(and(eq(contentItems.locale, locale), eq(contentItems.slug, slug), eq(contentItems.status, "published")));
  return item ?? null;
}

export async function listPublished(db: Db, locale?: string) {
  return db
    .select({
      locale: contentItems.locale,
      slug: contentItems.slug,
      type: contentItems.type,
      title: contentItems.title,
      summary: contentItems.summary,
      publishedAt: contentItems.publishedAt,
      updatedAt: contentItems.updatedAt,
    })
    .from(contentItems)
    .where(locale ? and(eq(contentItems.status, "published"), eq(contentItems.locale, locale)) : eq(contentItems.status, "published"))
    .orderBy(desc(contentItems.publishedAt));
}

export async function listPendingApprovals(db: Db) {
  return db
    .select({
      id: approvals.id,
      title: approvals.title,
      summary: approvals.summary,
      requestedBy: approvals.requestedBy,
      createdAt: approvals.createdAt,
      subjectVersion: approvals.subjectVersion,
      body: contentRevisions.body,
      liveStatus: contentItems.status,
      locale: contentItems.locale,
      slug: contentItems.slug,
    })
    .from(approvals)
    .innerJoin(contentItems, eq(contentItems.id, approvals.subjectId))
    .innerJoin(
      contentRevisions,
      and(eq(contentRevisions.contentId, approvals.subjectId), eq(contentRevisions.version, approvals.subjectVersion)),
    )
    .where(eq(approvals.status, "pending"))
    .orderBy(approvals.createdAt);
}

export async function getApprovalStatus(db: Db, approvalId: string) {
  const [row] = await db
    .select({ id: approvals.id, status: approvals.status, note: approvals.note, decidedAt: approvals.decidedAt })
    .from(approvals)
    .where(eq(approvals.id, approvalId));
  return row ?? null;
}
