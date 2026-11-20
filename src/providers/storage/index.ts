import type { Env } from "../registry";
import { randomUUID } from "node:crypto";
import { chosen } from "../registry";
import { localDisk } from "./local";

/*
 * File storage, provider-agnostic. STORAGE_PROVIDER = local today (FILES_DIR, default .data/files, outside Git);
 * EU object storage (S3-compatible) becomes one more adapter with the real server. Files are only served
 * through /api/files/[id], which checks who may see them.
 */
export type FileStore = {
  provider: string;
  put: (key: string, bytes: Uint8Array) => Promise<void>;
  get: (key: string) => Promise<Uint8Array>;
  remove: (key: string) => Promise<void>;
};

export function storageFromEnv(env: Env = process.env): FileStore {
  switch (chosen("storage", env)) {
    default:
      return localDisk(env);
  }
}

const KEY = /^[0-9a-f-]{36}$/;

export async function putFile(bytes: Uint8Array) {
  const key = randomUUID();
  await storageFromEnv().put(key, bytes);
  return key;
}

export async function getFile(key: string) {
  if (!KEY.test(key)) throw new Error("bad file key");
  return storageFromEnv().get(key);
}

export async function removeFile(key: string) {
  if (!KEY.test(key)) return;
  await storageFromEnv().remove(key);
}
