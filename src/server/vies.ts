import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { orders } from "@/db/schema";
import type { Actor } from "./actor";
import { audit, emit } from "./events";

/*
 * EU VAT number check (VIES) for orders (marketplace lesson: verify the buyer before money moves).
 * It matters for money: an EU customer with a VAT number gets reverse charge (0%), so a wrong number means
 * we under-charge VAT. A number VIES says is invalid falls back to Italian VAT; if VIES is down the order stays
 * unchecked and is tried again when the contract is sent.
 */

const VIES_URL = "https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number";
const EU = new Set(["AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "EL", "ES", "FI", "FR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK", "XI"]);

export type VatCheck = { valid: boolean; name: string | null };

/** "DE 123.456.789" with country DE → { cc: "DE", number: "123456789" }; Greece is "EL" in VIES. */
export function splitVat(vat: string, country: string | null) {
  const clean = vat.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const norm = (c: string) => (c === "GR" ? "EL" : c);
  const prefix = norm(clean.slice(0, 2));
  const prefixed = /^[A-Z]{2}$/.test(prefix) && EU.has(prefix);
  const cc = prefixed ? prefix : norm((country ?? "").toUpperCase());
  const number = prefixed ? clean.slice(2) : clean;
  return EU.has(cc) && number ? { cc, number } : null;
}

/** Asks VIES. null when the number is not an EU one or VIES (or the member state) does not answer. */
export async function checkVat(vat: string, country: string | null, fetchImpl: typeof fetch = fetch): Promise<VatCheck | null> {
  const s = splitVat(vat, country);
  if (!s || (fetchImpl === globalThis.fetch && process.env.VIES_DISABLED === "1")) return null;
  try {
    const res = await fetchImpl(VIES_URL, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ countryCode: s.cc, vatNumber: s.number }), signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { valid?: boolean; name?: string; actionSucceed?: boolean };
    if (typeof j.valid !== "boolean" || j.actionSucceed === false) return null;
    const name = j.name && j.name !== "---" ? j.name.trim() : null;
    return { valid: j.valid, name };
  } catch {
    return null;
  }
}

/** Checks an order's VAT number once (worker on order.created; again before the contract if VIES was down). */
export async function checkOrderVat(db: Db, orderId: string, fetchImpl: typeof fetch = fetch, now = new Date()) {
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o?.vat || o.vatCheckedAt) return o?.vatValid ?? null;
  const r = await checkVat(o.vat, o.country, fetchImpl);
  if (!r) return null;
  const actor: Actor = { type: "system", id: "vies" };
  await db.transaction(async (tx) => {
    await tx.update(orders).set({ vatValid: r.valid, vatName: r.name, vatCheckedAt: now }).where(eq(orders.id, orderId));
    await emit(tx, actor, "order.vat_checked", { type: "order", id: orderId }, { valid: r.valid, vat: o.vat, name: r.name, company: o.company });
    await audit(tx, actor, "order.vat_checked", { type: "order", id: orderId }, null, { valid: r.valid, name: r.name });
  });
  return r.valid;
}
