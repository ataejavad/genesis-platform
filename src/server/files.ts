import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/*
 * Where customer files live. Local disk for now (FILES_DIR, default .data/files, outside Git); the same two
 * functions move to EU object storage with the real server (step 11). Files are only served through
 * /api/files/[id], which checks who may see them.
 */
const dir = () => process.env.FILES_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), ".data", "files");

export async function putFile(bytes: Uint8Array) {
  const key = randomUUID();
  await mkdir(dir(), { recursive: true });
  await writeFile(path.join(dir(), key), bytes);
  return key;
}

export async function getFile(key: string) {
  if (!/^[0-9a-f-]{36}$/.test(key)) throw new Error("bad file key");
  return readFile(path.join(dir(), key));
}

export async function removeFile(key: string) {
  if (!/^[0-9a-f-]{36}$/.test(key)) return;
  await rm(path.join(dir(), key), { force: true });
}
