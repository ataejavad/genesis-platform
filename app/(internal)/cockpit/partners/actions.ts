"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { AppError } from "@/server/errors";
import { checkDocument, createJob, decideApplication, issuePartnerKey, markPaid, offerJob, sendPartnerMessage } from "@/server/partners";

// Cockpit actions for partners (step 6). Each acts as the signed-in admin and is audited in the module.
async function run(fn: (actor: { type: "user"; id: string }) => Promise<unknown>) {
  const user = await requireAdmin();
  try {
    await fn({ type: "user", id: user.id });
  } catch (err) {
    if (!(err instanceof AppError) && !(err instanceof Error && err.name === "ZodError")) throw err;
  }
  revalidatePath("/cockpit/partners");
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export type Result = { ok: boolean; message: string } | null;

/** Accepting opens the partner's login; the one-time password is shown once to pass on. */
export async function decide(_: Result, f: FormData): Promise<Result> {
  const user = await requireAdmin();
  try {
    const r = await decideApplication(getDb(), { type: "user", id: user.id }, str(f, "id"), str(f, "decision") === "accept");
    revalidatePath("/cockpit/partners");
    return { ok: true, message: str(f, "decision") === "accept" ? (r.password ? `Active. Login: ${str(f, "email")} · one-time password: ${r.password} (shown once) · /partner/login` : "Active; this email already had a login.") : "Rejected." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message.slice(0, 200) : "failed" };
  }
}

export async function newJob(_: Result, f: FormData): Promise<Result> {
  const user = await requireAdmin();
  try {
    const j = await createJob(getDb(), { type: "user", id: user.id }, {
      title: str(f, "title"), brief: str(f, "brief"), kind: str(f, "customer") ? "customer" : "internal", customerOrgId: str(f, "customer") || undefined,
      skills: f.getAll("skills").map(String), language: str(f, "language") || undefined, country: str(f, "country") || undefined, personalData: f.get("personal") === "on",
      payEur: Math.round(Number(str(f, "pay"))), priceEur: str(f, "price") ? Math.round(Number(str(f, "price"))) : undefined, dueAt: new Date(str(f, "due")),
      checklist: str(f, "checklist").split("\n").map((x) => x.trim()).filter(Boolean),
    });
    revalidatePath("/cockpit/partners");
    return { ok: true, message: `Job created: ${j.title}. Press "Offer to best matches" below.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message.slice(0, 300) : "failed" };
  }
}

export async function offer(f: FormData) {
  await run((a) => offerJob(getDb(), a, str(f, "job"), Number(str(f, "n") || 3)));
}
export async function paid(f: FormData) {
  await run((a) => markPaid(getDb(), a, str(f, "payout")));
}
export async function doc(f: FormData) {
  await run((a) => checkDocument(getDb(), a, str(f, "doc"), str(f, "ok") === "yes"));
}
export async function reply(f: FormData) {
  await run((a) => sendPartnerMessage(getDb(), a, str(f, "partner"), "us", str(f, "body")));
}

/** For partners that work through their own agent: a partner:work key, shown once (a new one revokes the old). */
export async function agentKey(_: Result, f: FormData): Promise<Result> {
  const user = await requireAdmin();
  try {
    const key = await issuePartnerKey(getDb(), { type: "user", id: user.id }, str(f, "id"));
    return { ok: true, message: `Key (shown once): ${key} · use as Bearer on /api/v1/partner/*` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message.slice(0, 200) : "failed" };
  }
}
