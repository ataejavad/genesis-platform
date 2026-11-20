import type { Env } from "../registry";
import { chosen } from "../registry";
import { metaWhatsApp, whatsappConfigFromEnv } from "./meta";

/*
 * WhatsApp channel, provider-agnostic. WHATSAPP_PROVIDER = meta | none (auto: meta when its keys are set).
 * Business code (src/server/whatsapp.ts) only sees incoming messages in our shape and a send function.
 */
export type IncomingMessage = { from: string; id: string; text: string; name?: string };

export type WhatsAppChannel = {
  provider: string;
  send: (to: string, text: string) => Promise<string | null>;
  /** the provider's webhook body → messages in our shape */
  parse: (body: unknown) => IncomingMessage[];
  /** checks the provider's signature on the raw webhook body */
  verify: (raw: string, headers: Headers) => boolean;
  /** the provider's one-time webhook check (GET); a Response when it is one */
  handshake: (url: URL) => Response | null;
};

export const digits = (phone: string) => phone.replace(/\D/g, "").replace(/^00/, "");

export function whatsappFromEnv(env: Env = process.env, fetchImpl: typeof fetch = fetch): WhatsAppChannel | null {
  if (chosen("whatsapp", env) !== "meta") return null;
  const cfg = whatsappConfigFromEnv(env);
  return cfg ? metaWhatsApp(cfg, fetchImpl) : null;
}

export { metaWhatsApp, type MetaWhatsAppConfig } from "./meta";
