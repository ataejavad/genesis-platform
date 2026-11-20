import type { Env } from "../registry";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FileStore } from ".";

/** Server disk: FILES_DIR, default .data/files (outside Git). */
export function localDisk(env: Env = process.env): FileStore {
  const dir = () => env.FILES_DIR ?? path.join(/* turbopackIgnore: true */ process.cwd(), ".data", "files");
  return {
    provider: "local",
    async put(key, bytes) {
      await mkdir(dir(), { recursive: true });
      await writeFile(path.join(dir(), key), bytes);
    },
    get: (key) => readFile(path.join(dir(), key)),
    remove: (key) => rm(path.join(dir(), key), { force: true }),
  };
}
