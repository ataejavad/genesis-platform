import type { Env } from "../registry";
import { chosen } from "../registry";

/*
 * Legal e-invoice transmission (Italy: SdI), provider-agnostic. EINVOICE_PROVIDER = manual today (numbered here,
 * sent by hand or by the accountant). The SdI intermediary chosen after registration becomes one adapter here.
 */
export type EInvoicer = { provider: string; transmit: (invoice: { id: string; number: string; totalEur: number }) => Promise<string | null> };

export const manualEInvoice: EInvoicer = { provider: "manual", transmit: async () => null };

export function einvoiceFromEnv(env: Env = process.env): EInvoicer {
  switch (chosen("einvoice", env)) {
    default:
      return manualEInvoice;
  }
}
