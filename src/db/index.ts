import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(url: string, max = 10) {
  const client = postgres(url, { max });
  return Object.assign(drizzle(client, { schema }), { $client: client });
}

export type Db = ReturnType<typeof createDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

const globalForDb = globalThis as unknown as { db?: Db };

// One pool per process; survives Next.js hot reload in dev.
export function getDb(): Db {
  if (!globalForDb.db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalForDb.db = createDb(url);
  }
  return globalForDb.db;
}

export { schema };
