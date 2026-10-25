import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(url: string, max = 10) {
  // Local mode shares one PGlite session between processes: named prepared statements would collide there.
  const client = postgres(url, { max, prepare: process.env.DATABASE_PREPARE !== "false" });
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
    // Local mode (npm run local) runs on PGlite, which needs one connection per process.
    globalForDb.db = createDb(url, Number(process.env.DATABASE_POOL_MAX ?? 10));
  }
  return globalForDb.db;
}

export { schema };
