"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { setLegalBasis, setRpo, setStage } from "@/server/crm";
import { AppError } from "@/server/errors";
import { approveSequence, completeTouch, editTouch, rejectSequence, setSwitch } from "@/server/outreach";
import type { Switch } from "@/server/outreach-rules";

// Cockpit actions for the outbound machine. Each one acts as the signed-in admin and is audited in the module.
async function run(fn: (actor: { type: "user"; id: string }) => Promise<unknown>) {
  const user = await requireAdmin();
  try {
    await fn({ type: "user", id: user.id });
  } catch (err) {
    // Already handled elsewhere or not allowed right now: the page shows the current state.
    if (!(err instanceof AppError)) throw err;
  }
  revalidatePath("/cockpit/outreach");
  revalidatePath("/cockpit/crm", "layout");
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function approve(f: FormData) {
  await run((a) => approveSequence(getDb(), a, str(f, "prospect")));
}
export async function reject(f: FormData) {
  await run((a) => rejectSequence(getDb(), a, str(f, "prospect"), str(f, "note") || undefined));
}
export async function edit(f: FormData) {
  await run((a) => editTouch(getDb(), a, str(f, "touch"), { body: str(f, "body"), subject: str(f, "subject") || null }));
}
export async function done(f: FormData) {
  await run((a) => completeTouch(getDb(), a, str(f, "touch"), str(f, "outcome")));
}
export async function rpo(f: FormData) {
  await run((a) => setRpo(getDb(), a, str(f, "prospect"), str(f, "listed") === "yes"));
}
export async function toggle(f: FormData) {
  await run((a) => setSwitch(getDb(), a, str(f, "country"), str(f, "channel") as Switch, str(f, "enabled") === "on"));
}
export async function stage(f: FormData) {
  await run((a) => setStage(getDb(), a, str(f, "prospect"), str(f, "stage"), str(f, "note") || undefined, str(f, "reason") || undefined));
}
export async function basis(f: FormData) {
  await run((a) => setLegalBasis(getDb(), a, str(f, "contact"), str(f, "basis") || null, str(f, "source") || null));
}
