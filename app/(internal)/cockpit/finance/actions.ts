"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { cancelInvoice, issuePaid, markBatchPaid, markInvoicePaid, saveCompany } from "@/server/finance";

// Cockpit finance actions (step 8). Money arrives in the bank; Javad marks it here (bank import later).
export type Result = { ok: boolean; message: string } | null;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

async function act(fn: (actor: { type: "user"; id: string }) => Promise<string>): Promise<Result> {
  const user = await requireAdmin();
  try {
    const message = await fn({ type: "user", id: user.id });
    revalidatePath("/cockpit/finance");
    revalidatePath("/cockpit/projects");
    return { ok: true, message };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message.slice(0, 300) : "failed" };
  }
}

export async function paid(_: Result, f: FormData): Promise<Result> {
  return act(async (a) => {
    const i = await markInvoicePaid(getDb(), a, str(f, "invoice"));
    return i.kind === "deposit" ? "Paid: the project has started and tasks went to partners." : "Paid.";
  });
}

export async function cancel(_: Result, f: FormData): Promise<Result> {
  return act(async (a) => (await cancelInvoice(getDb(), a, str(f, "invoice"), str(f, "why") || "cancelled in cockpit"), "Cancelled."));
}

export async function company(_: Result, f: FormData): Promise<Result> {
  return act(async (a) => {
    const opt = (k: string) => str(f, k) || undefined;
    const registered = f.get("registered") === "on";
    await saveCompany(getDb(), a, { legalName: str(f, "legalName"), vatId: opt("vatId"), taxCode: opt("taxCode"), address: opt("address"), country: str(f, "country") || "IT", iban: opt("iban"), bic: opt("bic"), email: opt("email"), registered });
    const n = registered ? await issuePaid(getDb(), a) : 0;
    return n ? `Saved. ${n} paid invoice(s) got their legal number.` : "Saved.";
  });
}

export async function batchPaid(_: Result, f: FormData): Promise<Result> {
  return act(async (a) => `${await markBatchPaid(getDb(), a, str(f, "ids").split(",").filter(Boolean))} payout(s) marked paid; partners are told.`);
}
