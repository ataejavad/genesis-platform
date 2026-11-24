"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { AppError } from "@/server/errors";
import { decideRadar, type RadarAction } from "@/server/radar";

// Cockpit actions for the solutions radar: the same module function the phone buttons call, audited there.
export async function decide(f: FormData) {
  const user = await requireAdmin();
  const op = String(f.get("op") ?? "");
  if (!["keep_post", "keep", "dismiss"].includes(op)) return;
  try {
    await decideRadar(getDb(), { type: "user", id: user.id }, String(f.get("id") ?? ""), op as RadarAction, String(f.get("note") ?? "") || undefined);
  } catch (err) {
    // decided on the phone in the meantime: the page shows the current state
    if (!(err instanceof AppError)) throw err;
  }
  revalidatePath("/cockpit/radar");
}
