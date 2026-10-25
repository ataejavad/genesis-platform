"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { apiKeys, partnerMessages } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { createApiKey, SCOPES, type Scope } from "@/server/api-keys";
import { audit } from "@/server/events";
import { decideFilter } from "@/server/market-filters";
import { setSwitch, STOP } from "@/server/switches";

// Cockpit control actions (step 10): emergency stop, job switches, market filters, API keys, moderation.
export type Result = { ok: boolean; message: string; secret?: string } | null;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function act(fn: (actor: { type: "user"; id: string }) => Promise<Result>): Promise<Result> {
  const user = await requireAdmin();
  try {
    const r = await fn({ type: "user", id: user.id });
    revalidatePath("/cockpit", "layout");
    return r;
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message.slice(0, 300) : "failed" };
  }
}

export async function emergency(_: Result, f: FormData): Promise<Result> {
  return act(async (a) => {
    const on = str(f, "op") === "stop";
    await setSwitch(getDb(), a, STOP, on, str(f, "note") || undefined);
    return { ok: true, message: on ? "Stopped: agents and outbound messages are held" : "Running again" };
  });
}

export async function jobSwitch(_: Result, f: FormData): Promise<Result> {
  return act(async (a) => {
    const on = str(f, "op") === "on";
    await setSwitch(getDb(), a, `job:${str(f, "job")}`, on);
    return { ok: true, message: on ? "Job on" : "Job off" };
  });
}

export async function filter(_: Result, f: FormData): Promise<Result> {
  return act(async (a) => {
    const approve = str(f, "op") === "approve";
    await decideFilter(getDb(), a, str(f, "country"), str(f, "nace"), approve, str(f, "note") || undefined);
    return { ok: true, message: approve ? "Approved" : "Paused: the company finder skips it" };
  });
}

export async function newKey(_: Result, f: FormData): Promise<Result> {
  return act(async (a) => {
    const name = str(f, "name");
    const scopes = f.getAll("scopes").map(String).filter((s): s is Scope => (SCOPES as readonly string[]).includes(s));
    if (name.length < 3 || !scopes.length) throw new Error("name and at least one scope");
    const db = getDb();
    const { id, key } = await createApiKey(db, { name, scopes });
    await audit(db, a, "api_key.created", { type: "api_key", id }, null, { name, scopes });
    return { ok: true, message: "Copy it now: it is shown once", secret: key };
  });
}

export async function revokeKey(_: Result, f: FormData): Promise<Result> {
  return act(async (a) => {
    const db = getDb();
    const id = str(f, "id");
    await db.update(apiKeys).set({ revokedAt: new Date() }).where(and(eq(apiKeys.id, id), isNull(apiKeys.revokedAt)));
    await audit(db, a, "api_key.revoked", { type: "api_key", id }, null, null);
    return { ok: true, message: "Revoked" };
  });
}

export async function seen(_: Result, f: FormData): Promise<Result> {
  return act(async (a) => {
    const db = getDb();
    const id = str(f, "id");
    await db.update(partnerMessages).set({ readAt: new Date() }).where(eq(partnerMessages.id, id));
    await audit(db, a, "partner_message.reviewed", { type: "partner_message", id }, null, null);
    return { ok: true, message: "Done" };
  });
}
