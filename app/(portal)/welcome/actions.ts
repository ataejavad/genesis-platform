"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { redeemInvite } from "@/server/notify";

/** Set-password link from the invite email (customers and partners): no password ever travels by email. */
export async function setPassword(_: string | null, f: FormData): Promise<string | null> {
  const password = String(f.get("password") ?? "");
  if (password.length < 12) return "short";
  let next: string;
  try {
    next = (await redeemInvite(getDb(), String(f.get("token") ?? ""), password)).next;
  } catch {
    return "bad";
  }
  redirect(`${next}?welcome=1`);
}
