/*
 * Where customer files live: src/providers/storage (STORAGE_PROVIDER; server disk today, EU object storage with
 * the real server). Files are only served through /api/files/[id], which checks who may see them.
 */
export { getFile, putFile, removeFile } from "@/providers/storage";
