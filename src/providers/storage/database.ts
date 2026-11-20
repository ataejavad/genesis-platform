import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { fileBlobs } from "@/db/schema";
import type { FileStore } from ".";

/**
 * Our own Postgres (table file_blobs): for hosts without a lasting disk, e.g. Vercel in the test phase.
 * Fine for the small files of a test; EU object storage (S3-compatible) is the next adapter for real volume.
 */
export function databaseStore(): FileStore {
  return {
    provider: "database",
    async put(key, bytes) {
      await getDb().insert(fileBlobs).values({ key, bytes }).onConflictDoUpdate({ target: fileBlobs.key, set: { bytes } });
    },
    async get(key) {
      const [row] = await getDb().select({ bytes: fileBlobs.bytes }).from(fileBlobs).where(eq(fileBlobs.key, key));
      if (!row) throw Object.assign(new Error(`file ${key} not found`), { code: "ENOENT" });
      return row.bytes;
    },
    async remove(key) {
      await getDb().delete(fileBlobs).where(eq(fileBlobs.key, key));
    },
  };
}
