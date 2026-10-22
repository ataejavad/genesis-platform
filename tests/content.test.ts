import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { approvals, auditLog, contentItems, events } from "@/db/schema";
import { createDraft, decideApproval, getPublished, listPendingApprovals } from "@/server/content";
import { agent, draft, javad, useTestDb } from "./helpers";

const db = useTestDb();

describe("draft → approval → publish", () => {
  it("a new draft is pending, not public, and asks for approval", async () => {
    const r = await createDraft(db, agent, draft());
    expect(r.version).toBe(1);
    expect(await getPublished(db, "de-de", "glass/ai-quoting")).toBeNull();
    const evs = await db.select().from(events);
    expect(evs.map((e) => e.type)).toEqual(["approval.requested"]);
    expect(evs[0].actor).toBe("agent:content-agent");
    expect(await listPendingApprovals(db)).toHaveLength(1);
  });

  it("approval publishes the page and records events and audit", async () => {
    const r = await createDraft(db, agent, draft());
    const { content } = await decideApproval(db, javad, r.approvalId, "approved");
    expect(content.status).toBe("published");
    expect((await getPublished(db, "de-de", "glass/ai-quoting"))?.body).toBe("# Hallo\n\nText v1");
    const types = (await db.select().from(events)).map((e) => e.type);
    expect(types).toEqual(["approval.requested", "content.published", "approval.decided"]);
    expect(await db.select().from(auditLog)).toHaveLength(2);
  });

  it("an edit to a live page keeps the old text live until approved", async () => {
    const first = await createDraft(db, agent, draft());
    await decideApproval(db, javad, first.approvalId, "approved");
    const second = await createDraft(db, agent, draft({ body: "Text v2" }));
    expect(second.version).toBe(2);
    expect((await getPublished(db, "de-de", "glass/ai-quoting"))?.body).toBe("# Hallo\n\nText v1");
    await decideApproval(db, javad, second.approvalId, "approved");
    const live = await getPublished(db, "de-de", "glass/ai-quoting");
    expect(live?.body).toBe("Text v2");
    expect(live?.version).toBe(2);
  });

  it("rejecting an edit leaves the live page untouched", async () => {
    const first = await createDraft(db, agent, draft());
    await decideApproval(db, javad, first.approvalId, "approved");
    const second = await createDraft(db, agent, draft({ body: "bad text" }));
    const { content } = await decideApproval(db, javad, second.approvalId, "rejected", "tone");
    expect(content.status).toBe("published");
    expect((await getPublished(db, "de-de", "glass/ai-quoting"))?.body).toBe("# Hallo\n\nText v1");
  });

  it("a newer draft supersedes the older pending one", async () => {
    const a = await createDraft(db, agent, draft());
    const b = await createDraft(db, agent, draft({ body: "newer" }));
    const [old] = await db.select().from(approvals).where(eq(approvals.id, a.approvalId));
    expect(old.status).toBe("rejected");
    await expect(decideApproval(db, javad, a.approvalId, "approved")).rejects.toMatchObject({ code: "conflict" });
    await decideApproval(db, javad, b.approvalId, "approved");
    expect((await getPublished(db, "de-de", "glass/ai-quoting"))?.body).toBe("newer");
  });

  it("cannot decide twice", async () => {
    const r = await createDraft(db, agent, draft());
    await decideApproval(db, javad, r.approvalId, "approved");
    await expect(decideApproval(db, javad, r.approvalId, "rejected")).rejects.toMatchObject({ status: 409 });
  });

  it("rejects bad slugs and locales", async () => {
    await expect(createDraft(db, agent, draft({ slug: "../etc" }))).rejects.toThrow();
    await expect(createDraft(db, agent, draft({ locale: "xx-yy" }))).rejects.toThrow();
    expect(await db.select().from(contentItems)).toHaveLength(0);
  });

  it("a market-scoped key cannot write to another market", async () => {
    await expect(
      createDraft(db, agent, draft(), { allowedMarketId: "11111111-1111-4111-8111-111111111111" }),
    ).rejects.toMatchObject({ status: 403 });
  });
});
