"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { revalidatePublished } from "@/lib/revalidate";
import { decideApproval } from "@/server/content";
import { AppError } from "@/server/errors";

export async function decide(formData: FormData) {
  const user = await requireAdmin();
  const id = String(formData.get("id"));
  const decision = formData.get("decision") === "approved" ? "approved" : "rejected";
  const note = String(formData.get("note") ?? "").trim() || undefined;
  try {
    const { content } = await decideApproval(getDb(), { type: "user", id: user.id }, id, decision, note);
    revalidatePublished(content);
  } catch (err) {
    // Already decided elsewhere (e.g. on Telegram): just refresh the list.
    if (!(err instanceof AppError)) throw err;
  }
  revalidatePath("/cockpit");
}
