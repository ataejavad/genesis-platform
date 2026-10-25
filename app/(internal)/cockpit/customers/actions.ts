"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { AppError } from "@/server/errors";
import { eraseCustomer } from "@/server/privacy";
import { addGoal, addOutcome, addSubscription, answerRequest, askCustomerApproval, createCustomer } from "@/server/portal";

// Cockpit actions for customer accounts (step 5). Each acts as the signed-in admin and is audited in the module.
async function run(fn: (actor: { type: "user"; id: string }) => Promise<unknown>) {
  const user = await requireAdmin();
  try {
    await fn({ type: "user", id: user.id });
  } catch (err) {
    if (!(err instanceof AppError) && !(err instanceof Error && err.name === "ZodError")) throw err;
  }
  revalidatePath("/cockpit/customers");
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(str(f, k).replace(",", "."));

export type OpenState = { ok: boolean; message: string } | null;

/** Opens an account; the one-time password is shown once to pass on to the customer. */
export async function openAccount(_: OpenState, f: FormData): Promise<OpenState> {
  const user = await requireAdmin();
  const actor = { type: "user" as const, id: user.id };
  try {
    const db = getDb();
    const out = await db.transaction(async (tx) => {
      const c = await createCustomer(tx, actor, {
        name: str(f, "name"), country: str(f, "country"), industry: str(f, "industry"), locale: str(f, "locale"),
        baselineEur: str(f, "baseline") ? Math.round(num(f, "baseline")) : null, email: str(f, "email"), contactName: str(f, "contact"),
      });
      if (str(f, "product") && num(f, "fee") > 0) await addSubscription(tx, actor, c.org.id, str(f, "product"), str(f, "plan") || "Standard", Math.round(num(f, "fee")));
      return c;
    });
    revalidatePath("/cockpit/customers");
    return { ok: true, message: out.password ? `Account open. Login: ${str(f, "email")} · one-time password: ${out.password} (shown once)` : `Account open; ${str(f, "email")} already had a login.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message.slice(0, 300) : "failed" };
  }
}

export async function recordResult(f: FormData) {
  await run((a) => addOutcome(getDb(), a, { orgId: str(f, "org"), metric: str(f, "metric"), value: num(f, "value"), eur: Math.round(num(f, "eur")), subscriptionId: str(f, "sub") || undefined }));
}
export async function askApproval(f: FormData) {
  await run((a) => askCustomerApproval(getDb(), a, { orgId: str(f, "org"), title: str(f, "title"), detail: str(f, "detail") || undefined, link: str(f, "link") || undefined }));
}
export async function reply(f: FormData) {
  await run((a) => answerRequest(getDb(), a, str(f, "id"), str(f, "reply"), str(f, "status") === "done" ? "done" : "in_progress"));
}
export async function goal(f: FormData) {
  await run((a) => addGoal(getDb(), a, { orgId: str(f, "org"), metric: str(f, "metric"), title: { [str(f, "lang") || "en"]: str(f, "title"), en: str(f, "title") }, baseline: num(f, "baseline"), target: num(f, "target"), unit: str(f, "unit") }));
}

/** GDPR erasure (irreversible): people, chats, material and files go; contracts and invoices stay (10 years, art. 2220 c.c.). */
export async function erase(_: OpenState, f: FormData): Promise<OpenState> {
  const user = await requireAdmin();
  if (str(f, "confirm") !== str(f, "company")) return { ok: false, message: "Type the company name exactly to confirm." };
  try {
    await eraseCustomer(getDb(), { type: "user", id: user.id }, str(f, "org"), str(f, "request") || undefined);
    revalidatePath("/cockpit/customers");
    return { ok: true, message: "Erased. Contracts and invoices kept for the legal 10 years." };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message.slice(0, 200) : "failed" };
  }
}
