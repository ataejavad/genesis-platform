import { and, eq } from "drizzle-orm";
import type { Db } from "../src/db";
import { contracts, partners } from "../src/db/schema";
import { confirmSignCode, createPartnerContract, requestSignCode } from "../src/server/contracts";

// Demo data only: signs a contract the way a person would (both codes), so the demo flows keep working.
export async function demoSign(db: Db, contractId: string, email: string, name: string) {
  const signer = { email, name, locale: "it" };
  for (const step of ["sign", "clauses"] as const) {
    await requestSignCode(db, contractId, step, signer, new Date(), () => "000000");
    const r = await confirmSignCode(db, contractId, step, { code: "000000", answers: { ownHours: true, otherClients: true, ownTools: true } }, { signer, ip: "127.0.0.1", ua: "demo" });
    if (!r.ok || r.done) return;
  }
}

/** The demo partner's framework agreement, made if missing and signed. */
export async function demoSignPartner(db: Db, partnerId: string) {
  const [p] = await db.select().from(partners).where(eq(partners.id, partnerId));
  const [signed] = await db.select({ id: contracts.id }).from(contracts).where(and(eq(contracts.partnerId, partnerId), eq(contracts.status, "signed")));
  if (signed) return;
  const c = await db.transaction((tx) => createPartnerContract(tx, { type: "system", id: "demo" }, partnerId));
  await demoSign(db, c.id, p.email, p.name);
}
