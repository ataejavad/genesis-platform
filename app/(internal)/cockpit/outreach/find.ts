"use server";

import { revalidatePath } from "next/cache";
import type { RunCompany } from "@/agents/outbound";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { adminChatFromEnv } from "@/server/admin-chat";
import { findCustomers } from "@/server/outbound-run";

export type FindResult = { ok: boolean; message: string; companies?: RunCompany[] } | null;

/** One company-finder run from the cockpit, as the signed-in admin (audited in the module). */
export async function findNow(_prev: FindResult, f: FormData): Promise<FindResult> {
  const user = await requireAdmin();
  const [industry, region] = String(f.get("market") ?? "").split("|");
  try {
    const s = await findCustomers(getDb(), { type: "user", id: user.id }, { industry, region: region || undefined, limit: Number(f.get("limit") ?? 10) }, { adminChat: adminChatFromEnv() });
    revalidatePath("/cockpit/outreach");
    revalidatePath("/cockpit/crm", "layout");
    const parts = [`${s.found} found`, `${s.added} new with drafts`, s.duplicates ? `${s.duplicates} already in CRM` : "", s.failed ? `${s.failed} failed` : "", `${s.researched} researched`, `about €${s.costEur}`, ...s.skipped, ...s.errors.map((e) => `⚠ ${e}`)];
    return { ok: s.added > 0 || s.duplicates > 0, message: parts.filter(Boolean).join(" · "), companies: s.companies };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message.slice(0, 300) : "failed" };
  }
}
