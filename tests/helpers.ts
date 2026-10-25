import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeEach } from "vitest";
import { createDb, type Db } from "@/db";
import { contracts, invoices, orders, partners } from "@/db/schema";
import type { Actor } from "@/server/actor";
import { confirmSignCode, requestSignCode, sendContract } from "@/server/contracts";
import { markInvoicePaid } from "@/server/finance";

export function useTestDb() {
  const db = createDb(process.env.TEST_DATABASE_URL!, 5);
  beforeEach(async () => {
    await db.execute(sql`truncate content_items, approvals, events, audit_log, agent_runs, api_keys, markets, leads, checkups, prospects, contacts, touches, company_pages, inbox, channel_switches, organizations, "user", partners, jobs, protocols, service_packages, orders, projects, company_profile, contracts, invoices, notifications, invite_tokens cascade`);
  });
  afterAll(() => db.$client.end());
  return db;
}

export const agent = { type: "agent", id: "content-agent", apiKeyId: "00000000-0000-0000-0000-000000000000" } as const;
export const javad = { type: "user", id: "javad" } as const;

export const draft = (over: Record<string, unknown> = {}) => ({
  locale: "de-de",
  slug: "glass/ai-quoting",
  title: "KI-Angebote für Glasereien",
  summary: "Angebote in Minuten statt Tagen",
  body: "# Hallo\n\nText v1",
  ...over,
});

/* Step 8 gate: contracts are signed (two codes) and deposits paid before work starts. */
const CODE = "123456";
const YES = { ownHours: true, otherClients: true, ownTools: true };

export async function signContract(db: Db, contractId: string, email: string, answers: Record<string, boolean> = YES) {
  const signer = { email, name: "Test Signer", locale: "it" };
  for (const step of ["sign", "clauses"] as const) {
    await requestSignCode(db, contractId, step, signer, new Date(), () => CODE);
    const r = await confirmSignCode(db, contractId, step, { code: CODE, answers }, { signer, ip: "127.0.0.1", ua: "vitest" });
    if (!r.ok) throw new Error("code rejected");
    if (r.done) return r.contract;
  }
  throw new Error("not completed");
}

/** The partner signs the framework agreement made when they were accepted. */
export async function signPartner(db: Db, partnerId: string) {
  const [p] = await db.select().from(partners).where(eq(partners.id, partnerId));
  const [c] = await db.select().from(contracts).where(and(eq(contracts.partnerId, partnerId), eq(contracts.status, "sent")));
  return signContract(db, c.id, p.email);
}

/** Order → contract → signed → deposit paid → project (what convertOrder alone did before step 8). */
export async function startOrder(db: Db, actor: Actor, orderId: string) {
  const sent = await sendContract(db, actor, orderId);
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  await signContract(db, sent.contract.id, o.email!);
  const [dep] = await db.select().from(invoices).where(and(eq(invoices.orderId, orderId), eq(invoices.kind, "deposit")));
  if (dep) await markInvoicePaid(db, actor, dep.id);
  const [after] = await db.select().from(orders).where(eq(orders.id, orderId));
  return { projectId: after.projectId!, password: sent.password, contractId: sent.contract.id, depositId: dep?.id ?? null };
}
