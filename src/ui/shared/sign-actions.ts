"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { confirmSignCode, getContract, requestSignCode, type Signer } from "@/server/contracts";
import { partnerForUser } from "@/server/partners";
import { customerOrgFor } from "@/server/portal";

// Signing a contract from the customer or partner portal. Only a member of the contract's company, or the
// partner it was made for, can sign; admins viewing a portal cannot.
export type SignState = { ok: boolean; demoCode?: string | null; error?: string; done?: boolean; stage?: "clauses" };

async function signerFor(contractId: string): Promise<{ signer: Signer; path: string } | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const db = getDb();
  const c = await getContract(db, contractId);
  if (c.kind === "customer") {
    const mine = await customerOrgFor(db, user.id);
    if (!mine || mine.org.id !== c.orgId) return null;
    return { signer: { email: user.email, name: user.name, locale: mine.org.locale ?? c.language }, path: `/portal/contract/${c.id}` };
  }
  const p = await partnerForUser(db, user.id);
  if (!p || p.id !== c.partnerId) return null;
  return { signer: { email: user.email, name: user.name, locale: p.locale ?? c.language }, path: `/partner/contract/${c.id}` };
}

export async function askSignCode(contractId: string, step: "sign" | "clauses"): Promise<SignState> {
  const who = await signerFor(contractId);
  if (!who) return { ok: false, error: "forbidden" };
  try {
    const r = await requestSignCode(getDb(), contractId, step, who.signer);
    return { ok: true, demoCode: r.demoCode };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "failed" };
  }
}

export async function confirmSign(contractId: string, step: "sign" | "clauses", code: string, answers?: Record<string, boolean>): Promise<SignState> {
  const who = await signerFor(contractId);
  if (!who) return { ok: false, error: "forbidden" };
  const h = await headers();
  try {
    const r = await confirmSignCode(getDb(), contractId, step, { code, answers }, { signer: who.signer, ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null, ua: h.get("user-agent") });
    if (!r.ok) return { ok: false, error: "wrong" };
    revalidatePath(who.path);
    return r.done ? { ok: true, done: true } : { ok: true, stage: "clauses" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "failed" };
  }
}
