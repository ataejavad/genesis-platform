import type { Env } from "../registry";
import { chosen } from "../registry";

/*
 * How a customer pays, provider-agnostic. PAYMENTS_PROVIDER = bank-transfer (today: IBAN + EPC QR code, Javad
 * marks paid in Finance). Stripe comes later as one more adapter returning a `payUrl`; finance logic stays.
 */
export type PayInstructions = { provider: string; method: "bank_transfer" | "online"; qrPayload: string | null; payUrl: string | null };
export type Payee = { legalName: string | null; iban: string | null; bic: string | null };
export type Payments = { provider: string; howToPay: (payee: Payee, invoice: { totalEur: number; reference: string }) => Promise<PayInstructions> };

/** EPC QR payload (SEPA credit transfer, scanned by any EU banking app). */
export function epcPayload(co: Payee, i: { totalEur: number; reference: string }) {
  if (!co.iban || !co.legalName) return null;
  return ["BCD", "002", "1", "SCT", co.bic ?? "", co.legalName.slice(0, 70), co.iban, `EUR${i.totalEur.toFixed(2)}`, "", "", i.reference].join("\n");
}

export const bankTransfer: Payments = {
  provider: "bank-transfer",
  howToPay: async (payee, invoice) => ({ provider: "bank-transfer", method: "bank_transfer", qrPayload: epcPayload(payee, invoice), payUrl: null }),
};

export function paymentsFromEnv(env: Env = process.env): Payments {
  switch (chosen("payments", env)) {
    default:
      return bankTransfer;
  }
}
