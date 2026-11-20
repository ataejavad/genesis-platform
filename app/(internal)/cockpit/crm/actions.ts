"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { wonToOrder } from "@/server/crm";

export type Result = { ok: boolean; message: string } | null;

/** Deal won: the order is made from the CRM data (no re-typing); its contract goes out from Projects. */
export async function won(_: Result, f: FormData): Promise<Result> {
  const user = await requireAdmin();
  try {
    await wonToOrder(getDb(), { type: "user", id: user.id }, String(f.get("prospect")), String(f.get("package")));
    revalidatePath("/cockpit/crm", "layout");
    revalidatePath("/cockpit/projects");
    return { ok: true, message: "Won: order created. Send its contract from Projects." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message.slice(0, 200) : "failed" };
  }
}
