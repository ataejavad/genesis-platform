import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { apiKeys } from "@/db/schema";
import { authenticateAgent, createApiKey } from "@/server/api-keys";
import { useTestDb } from "./helpers";

const db = useTestDb();

describe("agent API keys", () => {
  it("authenticates a valid key and stores only its hash", async () => {
    const { id, key } = await createApiKey(db, { name: "content-agent", scopes: ["content:draft"] });
    const auth = await authenticateAgent(db, `Bearer ${key}`, "content:draft");
    expect(auth.actor).toMatchObject({ type: "agent", id: "content-agent", apiKeyId: id });
    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    expect(row.hash).not.toContain(key);
    expect(row.lastUsedAt).not.toBeNull();
  });

  it("rejects missing, unknown, revoked and under-scoped keys", async () => {
    const { id, key } = await createApiKey(db, { name: "a", scopes: ["content:read"] });
    await expect(authenticateAgent(db, null, "content:read")).rejects.toMatchObject({ status: 401 });
    await expect(authenticateAgent(db, "Bearer gk_nope", "content:read")).rejects.toMatchObject({ status: 401 });
    await expect(authenticateAgent(db, `Bearer ${key}`, "content:draft")).rejects.toMatchObject({ status: 403 });
    await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id));
    await expect(authenticateAgent(db, `Bearer ${key}`, "content:read")).rejects.toMatchObject({ status: 401 });
  });
});
