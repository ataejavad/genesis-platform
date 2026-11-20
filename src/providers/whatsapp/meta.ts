import type { Env } from "../registry";
import { createHmac, timingSafeEqual } from "node:crypto";
import { digits, type IncomingMessage, type WhatsAppChannel } from ".";

/*
 * Meta WhatsApp Cloud API: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_VERIFY_TOKEN, WHATSAPP_APP_SECRET.
 * Meta calls /api/v1/whatsapp; free-form replies only within 24 hours of the customer's last message.
 */
export type MetaWhatsAppConfig = { token: string; phoneNumberId: string; verifyToken: string; appSecret: string | null };

export function whatsappConfigFromEnv(env: Env = process.env): MetaWhatsAppConfig | null {
  if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID || !env.WHATSAPP_VERIFY_TOKEN) return null;
  return { token: env.WHATSAPP_TOKEN, phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID, verifyToken: env.WHATSAPP_VERIFY_TOKEN, appSecret: env.WHATSAPP_APP_SECRET ?? null };
}

/** Meta signs each webhook with the app secret (X-Hub-Signature-256). */
export function validSignature(raw: string, header: string | null, secret: string | null) {
  if (!secret) return true; // not configured yet: accepted, but the cockpit shows "unsigned"
  if (!header?.startsWith("sha256=")) return false;
  const want = Buffer.from(createHmac("sha256", secret).update(raw).digest("hex"));
  const got = Buffer.from(header.slice(7));
  return want.length === got.length && timingSafeEqual(want, got);
}

export function parseWebhook(body: unknown): IncomingMessage[] {
  const out: IncomingMessage[] = [];
  const entries = (body as { entry?: { changes?: { value?: { contacts?: { profile?: { name?: string }; wa_id?: string }[]; messages?: { from: string; id: string; type: string; text?: { body?: string }; button?: { text?: string }; interactive?: { button_reply?: { title?: string } } }[] } }[] }[] })?.entry ?? [];
  for (const e of entries)
    for (const c of e.changes ?? []) {
      const names = new Map((c.value?.contacts ?? []).map((x) => [x.wa_id, x.profile?.name]));
      for (const m of c.value?.messages ?? []) {
        const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? `[${m.type}]`;
        out.push({ from: digits(m.from), id: m.id, text: text.slice(0, 4000), name: names.get(m.from) });
      }
    }
  return out;
}

export function metaWhatsApp(cfg: MetaWhatsAppConfig, fetchImpl: typeof fetch = fetch): WhatsAppChannel {
  return {
    provider: "meta",
    async send(to, text) {
      const res = await fetchImpl(`https://graph.facebook.com/v21.0/${cfg.phoneNumberId}/messages`, {
        method: "POST",
        headers: { authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
      });
      const body = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
      if (!res.ok) throw new Error(`whatsapp ${res.status}: ${body.error?.message ?? "error"}`);
      return body.messages?.[0]?.id ?? null;
    },
    parse: parseWebhook,
    verify: (raw, headers) => validSignature(raw, headers.get("x-hub-signature-256"), cfg.appSecret),
    handshake(url) {
      const q = url.searchParams;
      if (q.get("hub.mode") !== "subscribe") return null;
      return q.get("hub.verify_token") === cfg.verifyToken ? new Response(q.get("hub.challenge") ?? "") : new Response("forbidden", { status: 403 });
    },
  };
}
