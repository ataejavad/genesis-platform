"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { approveVersion, convertOrder, createProject, draftVersion, humanReview, quoteChange, rejectOrder } from "@/server/projects";

// Cockpit actions for step 7 (orders, projects, protocols, QA). Each acts as the signed-in admin; audited in the module.
export type Result = { ok: boolean; message: string } | null;

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const lines = (f: FormData, k: string) => str(f, k).split("\n").map((x) => x.trim()).filter(Boolean);
const fail = (err: unknown): Result => ({ ok: false, message: err instanceof Error ? err.message.slice(0, 300) : "failed" });

async function act(fn: (actor: { type: "user"; id: string }) => Promise<string>, paths: string[]): Promise<Result> {
  const user = await requireAdmin();
  try {
    const message = await fn({ type: "user", id: user.id });
    for (const p of paths) revalidatePath(p);
    return { ok: true, message };
  } catch (err) {
    return fail(err);
  }
}

/** Order → customer account (if new; one-time password shown once) → project → offers to partners. */
export async function convert(_: Result, f: FormData): Promise<Result> {
  return act(async (a) => {
    const r = await convertOrder(getDb(), a, str(f, "order"));
    return r.password ? `Project started. New customer login: ${str(f, "email")} · one-time password: ${r.password} (shown once; copy it before reloading) · /portal/login` : "Project started; tasks offered to partners. Reload to see it.";
    // no revalidation: the one-time password must stay on screen until Javad has copied it
  }, []);
}

export async function reject(_: Result, f: FormData): Promise<Result> {
  return act(async (a) => (await rejectOrder(getDb(), a, str(f, "order"), str(f, "note") || "rejected"), "Rejected."), ["/cockpit/projects"]);
}

export async function newProject(_: Result, f: FormData): Promise<Result> {
  return act(async (a) => {
    const p = await createProject(getDb(), a, { orgId: str(f, "customer") || null, packageSlug: str(f, "package"), sensitiveData: f.get("sensitive") === "on" });
    return `${p.code} started; tasks offered to partners.`;
  }, ["/cockpit/projects"]);
}

export async function quote(_: Result, f: FormData): Promise<Result> {
  return act(async (a) => (await quoteChange(getDb(), a, str(f, "project"), str(f, "text"), Math.round(Number(str(f, "price") || 0)), Math.round(Number(str(f, "days") || 0))), "Sent to the customer for approval."), [`/cockpit/projects/${str(f, "project")}`]);
}

export async function approveProtocol(_: Result, f: FormData): Promise<Result> {
  return act(async (a) => (await approveVersion(getDb(), a, str(f, "version")), "Approved: new projects use this version."), ["/cockpit/protocols"]);
}

/** Criteria lines: "! judge Text" = mandatory, checked by the judge; "? human Text" = optional, checked by a person. */
export async function draftProtocol(_: Result, f: FormData): Promise<Result> {
  return act(async (a) => {
    const criteria = lines(f, "criteria").map((l) => {
      const m = l.match(/^([!?])\s*(auto|judge|human)\s+(.+)$/);
      if (!m) throw new Error(`criterion line not understood: "${l}" (use "! judge text" or "? human text")`);
      return { text: m[3], mandatory: m[1] === "!", weight: m[1] === "!" ? 2 : 1, method: m[2] as "auto" | "judge" | "human" };
    });
    const v = await draftVersion(getDb(), a, str(f, "protocol"), { goal: str(f, "goal"), inputs: lines(f, "inputs"), deliverables: lines(f, "deliverables"), criteria, guidance: str(f, "guidance") || undefined, standardDays: Number(str(f, "days")), changeNote: str(f, "note") });
    return `Draft v${v.version} saved. Approve it in the library to use it.`;
  }, ["/cockpit/protocols"]);
}

/** A person's QA: pass/fail per criterion. Any mandatory fail sends it back to the partner with the note. */
export async function qaDecide(_: Result, f: FormData): Promise<Result> {
  return act(async (a) => {
    const n = Number(str(f, "n"));
    const results = Array.from({ length: n }, (_, idx) => ({ idx, result: (f.get(`c${idx}`) === "fail" ? "fail" : "pass") as "pass" | "fail" }));
    const r = await humanReview(getDb(), a, str(f, "delivery"), results, Number(str(f, "quality") || 4), str(f, "note"));
    return r.payout ? "Accepted: payout due, milestone checked." : "Sent back to the partner with your note.";
  }, ["/cockpit/qa", "/cockpit/projects", "/cockpit/partners"]);
}
