import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { invoices, orders } from "@/db/schema";
import { sendContract } from "@/server/contracts";
import { requestInvoice } from "@/server/finance";
import { createOrder, seedDelivery } from "@/server/projects";
import { checkOrderVat, checkVat, splitVat } from "@/server/vies";
import { useTestDb } from "./helpers";

const db = useTestDb();
const javad = { type: "user", id: "javad" } as const;
const sys = { type: "system", id: "test" } as const;

/** A VIES stand-in: valid when the number ends in 9, down for "000". */
const fakeVies = (async (_url: string, init: { body: string }) => {
  const { vatNumber } = JSON.parse(init.body) as { vatNumber: string };
  if (vatNumber.endsWith("000")) return new Response("{}", { status: 503 });
  return Response.json({ valid: vatNumber.endsWith("9"), name: vatNumber.endsWith("9") ? "MUSTER GMBH" : "---" });
}) as unknown as typeof fetch;

describe("VAT check (VIES)", () => {
  it("reads country prefixes, Greece as EL, and ignores non-EU numbers", () => {
    expect(splitVat("DE 123.456.789", null)).toEqual({ cc: "DE", number: "123456789" });
    expect(splitVat("12345678901", "it")).toEqual({ cc: "IT", number: "12345678901" });
    expect(splitVat("GR123456789", null)).toEqual({ cc: "EL", number: "123456789" });
    expect(splitVat("CHE-123.456.789", "CH")).toBeNull();
  });

  it("answers valid / invalid, and null when VIES is down", async () => {
    expect(await checkVat("DE123456789", null, fakeVies)).toEqual({ valid: true, name: "MUSTER GMBH" });
    expect(await checkVat("DE123456781", null, fakeVies)).toEqual({ valid: false, name: null });
    expect(await checkVat("DE123456000", null, fakeVies)).toBeNull();
  });

  it("an invalid number loses reverse charge and shows as a risk on the contract", async () => {
    await seedDelivery(db);
    const bad = await createOrder(db, sys, { packageSlug: "lead-crm", source: "market", company: "Falsch GmbH", email: "f@example.com", vat: "DE123456781", country: "DE", industry: "installers", locale: "de" });
    expect(await checkOrderVat(db, bad.id, fakeVies)).toBe(false);
    const { contract, orgId } = await sendContract(db, javad, bad.id, fakeVies);
    expect(contract.summary.risks.join(" ")).toMatch(/not valid in VIES/);
    const inv = await db.transaction((tx) => requestInvoice(tx, sys, { orgId, kind: "deposit", title: "x", netEur: 100 }));
    expect(inv!.vatRate).toBe(22);

    const good = await createOrder(db, sys, { packageSlug: "lead-crm", source: "market", company: "Muster GmbH", email: "m@example.com", vat: "DE123456789", country: "DE", industry: "installers", locale: "de" });
    // VIES checked at Send contract when the worker had not
    const sent = await sendContract(db, javad, good.id, fakeVies);
    const [o] = await db.select().from(orders).where(eq(orders.id, good.id));
    expect(o).toMatchObject({ vatValid: true, vatName: "MUSTER GMBH" });
    const inv2 = await db.transaction((tx) => requestInvoice(tx, sys, { orgId: sent.orgId, kind: "deposit", title: "x", netEur: 100 }));
    expect(inv2!.vatRate).toBe(0);
    expect((await db.select().from(invoices)).length).toBeGreaterThanOrEqual(2);
  });
});
