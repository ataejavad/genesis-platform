import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db";
import { apiKeys } from "@/db/schema";
import type { Actor } from "./actor";
import { AppError, forbidden } from "./errors";

export const SCOPES = ["content:draft", "content:read", "crm:write", "outreach:run", "portal:write"] as const;
export type Scope = (typeof SCOPES)[number];

const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

// Returns the plain key once; only its hash is stored.
export async function createApiKey(db: Db, input: { name: string; scopes: Scope[]; marketId?: string }) {
  const key = `gk_${randomBytes(24).toString("base64url")}`;
  const [row] = await db
    .insert(apiKeys)
    .values({ name: input.name, prefix: key.slice(0, 10), hash: hashKey(key), scopes: input.scopes, marketId: input.marketId })
    .returning({ id: apiKeys.id });
  return { id: row.id, key };
}

export type AgentAuth = { actor: Actor & { type: "agent" }; marketId: string | null };

export async function authenticateAgent(db: Db, authorization: string | null, scope: Scope): Promise<AgentAuth> {
  const key = authorization?.match(/^Bearer\s+(gk_[\w-]+)$/)?.[1];
  if (!key) throw new AppError(401, "unauthorized", "missing or malformed API key");
  const [row] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.hash, hashKey(key)), isNull(apiKeys.revokedAt)));
  if (!row) throw new AppError(401, "unauthorized", "unknown or revoked API key");
  if (!row.scopes.includes(scope)) throw forbidden(`key lacks scope ${scope}`);
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
  return { actor: { type: "agent", id: row.name, apiKeyId: row.id }, marketId: row.marketId };
}
