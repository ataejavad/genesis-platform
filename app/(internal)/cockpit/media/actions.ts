"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { AppError } from "@/server/errors";
import { confirmMediaPosted, decideMedia, editMedia } from "@/server/media";

// Cockpit actions for the media engine: the same module functions the phone buttons call, audited there.
async function run(fn: (actor: { type: "user"; id: string }) => Promise<unknown>) {
  const user = await requireAdmin();
  try {
    await fn({ type: "user", id: user.id });
  } catch (err) {
    // decided on the phone in the meantime, or not allowed now: the page shows the current state
    if (!(err instanceof AppError)) throw err;
  }
  revalidatePath("/cockpit/media");
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function approve(f: FormData) {
  await run((a) => decideMedia(getDb(), a, str(f, "id"), true));
}
export async function reject(f: FormData) {
  await run((a) => decideMedia(getDb(), a, str(f, "id"), false, str(f, "note") || undefined));
}
export async function edit(f: FormData) {
  await run((a) => editMedia(getDb(), a, str(f, "id"), { title: str(f, "title"), body: str(f, "body") }));
}
export async function posted(f: FormData) {
  await run((a) => confirmMediaPosted(getDb(), a, str(f, "id"), str(f, "op") === "posted"));
}
