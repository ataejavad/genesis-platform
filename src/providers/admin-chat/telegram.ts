import type { Env } from "../registry";
import { createHash, timingSafeEqual } from "node:crypto";
import type { AdminChat, ApprovalPress } from ".";

/*
 * Telegram bot: TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, TELEGRAM_ADMIN_USER_IDS (who may approve),
 * TELEGRAM_WEBHOOK_SECRET (checked on /api/telegram/webhook).
 * Only the token and the chat id are needed: in a private chat the chat id IS the founder's user id, so it is the
 * default approver, and the webhook secret defaults to one derived from the token (nobody has to invent one).
 */
export type TelegramConfig = { botToken: string; adminChatId: string; adminUserIds: string[]; appUrl: string; webhookSecret?: string };

export function telegramConfigFromEnv(env: Env = process.env): TelegramConfig | null {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_ADMIN_CHAT_ID) return null;
  return {
    botToken: env.TELEGRAM_BOT_TOKEN,
    adminChatId: env.TELEGRAM_ADMIN_CHAT_ID,
    adminUserIds: (env.TELEGRAM_ADMIN_USER_IDS || env.TELEGRAM_ADMIN_CHAT_ID).split(",").map((s) => s.trim()).filter(Boolean),
    appUrl: env.APP_URL ?? "",
    webhookSecret: env.TELEGRAM_WEBHOOK_SECRET && env.TELEGRAM_WEBHOOK_SECRET !== "CHANGE_ME" ? env.TELEGRAM_WEBHOOK_SECRET : derivedSecret(env.TELEGRAM_BOT_TOKEN),
  };
}

/** Telegram allows A-Z a-z 0-9 _ - in the secret; a hash of the token is stable and never leaves our side. */
const derivedSecret = (token: string) => createHash("sha256").update(`genesis-webhook:${token}`).digest("hex").slice(0, 48);

/** Setup helper: private chats that recently wrote to the bot (needs no chat id yet, and no webhook set). */
export async function telegramRecentChats(botToken: string, fetchImpl: typeof fetch = fetch) {
  const res = await fetchImpl(`https://api.telegram.org/bot${botToken}/getUpdates`, { signal: AbortSignal.timeout(15_000) });
  const json = (await res.json()) as { ok: boolean; description?: string; result?: { message?: { chat: { id: number; type: string; first_name?: string; username?: string } } }[] };
  if (!json.ok) throw new Error(`telegram getUpdates: ${json.description ?? res.status}`);
  const chats = new Map<string, string>();
  for (const u of json.result ?? []) {
    const c = u.message?.chat;
    if (c?.type === "private") chats.set(String(c.id), c.first_name ?? c.username ?? "");
  }
  return [...chats].map(([id, name]) => ({ id, name }));
}

/** Telegram messages hold at most 4096 characters. */
const clip = (s: string) => (s.length > 3300 ? `${s.slice(0, 3300)}…` : s);

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function secretMatches(given: string | null, expected: string | undefined) {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

type CallbackQuery = { id: string; from: { id: number; username?: string }; data?: string; message?: { message_id: number; chat: { id: number }; text?: string } };

export function telegramChat(cfg: TelegramConfig, fetchImpl: typeof fetch = fetch): AdminChat {
  async function call(method: string, body: unknown) {
    const res = await fetchImpl(`https://api.telegram.org/bot${cfg.botToken}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { ok: boolean; result?: any; description?: string };
    if (!json.ok) throw new Error(`telegram ${method}: ${json.description ?? res.status}`);
    return json.result;
  }

  return {
    provider: "telegram",
    async alert(lines, link) {
      const text = [...lines.map(escapeHtml), link && cfg.appUrl ? `<a href="${cfg.appUrl}${link}">باز کردن</a>` : ""].filter(Boolean).join("\n");
      await call("sendMessage", { chat_id: cfg.adminChatId, text, parse_mode: "HTML" });
    },
    async askApproval(a) {
      const text = [
        "🟡 <b>درخواست تأیید</b>",
        `<b>${escapeHtml(a.title)}</b>`,
        a.summary ? escapeHtml(a.summary) : "",
        a.requestedBy ? `از طرف: <code>${escapeHtml(a.requestedBy)}</code>` : "",
        cfg.appUrl ? `<a href="${cfg.appUrl}/cockpit">باز کردن کابین</a>` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      const msg = await call("sendMessage", {
        chat_id: cfg.adminChatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
        reply_markup: { inline_keyboard: [[{ text: "✅ تأیید و انتشار", callback_data: `apr:${a.id}:a` }, { text: "❌ رد", callback_data: `apr:${a.id}:r` }]] },
      });
      return String(msg.message_id);
    },
    async askDecision(a) {
      // cut before escaping, so a cut never splits an HTML entity
      const text = `🟡 <b>${escapeHtml(a.title.slice(0, 200))}</b>\n\n${escapeHtml(clip(a.lines.filter(Boolean).join("\n\n")))}`;
      const rows: { text: string; callback_data?: string; url?: string }[][] = [
        [
          { text: a.approveLabel, callback_data: `d:${a.ref}:a` },
          { text: a.rejectLabel, callback_data: `d:${a.ref}:r` },
        ],
      ];
      // a link button needs a public https address; without one the cockpit is still one tap away in the alerts
      if (a.link && cfg.appUrl.startsWith("https://")) rows.push([{ text: a.linkLabel ?? "✏️ باز کردن در کابین", url: `${cfg.appUrl}${a.link}` }]);
      const msg = await call("sendMessage", { chat_id: cfg.adminChatId, text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: { inline_keyboard: rows } });
      return String(msg.message_id);
    },
    async status() {
      const info = (await call("getWebhookInfo", {})) as { url?: string; pending_update_count?: number; last_error_message?: string };
      return { connected: Boolean(info.url), url: info.url || undefined, pending: info.pending_update_count ?? 0, lastError: info.last_error_message ?? null };
    },
    async connect(webhookUrl) {
      await call("setWebhook", { url: webhookUrl, secret_token: cfg.webhookSecret, allowed_updates: ["callback_query"] });
    },
    async readPress(headers, body): Promise<ApprovalPress | "forbidden" | null> {
      if (!secretMatches(headers.get("x-telegram-bot-api-secret-token"), cfg.webhookSecret)) return "forbidden";
      const cq = (body as { callback_query?: CallbackQuery })?.callback_query;
      const match = cq?.data?.match(/^(apr|d):([0-9a-f-]{36}):([ar])$/);
      if (!cq || !match) return null;
      // the chat must be the founder's chat AND the person one of the approvers (a bot added to a group can't approve)
      const allowed = cfg.adminUserIds.includes(String(cq.from.id)) && (!cq.message || String(cq.message.chat.id) === cfg.adminChatId);
      return {
        target: match[1] === "apr" ? "approval" : "ask",
        id: match[2],
        decision: match[3] === "a" ? "approved" : "rejected",
        by: String(cq.from.id),
        allowed,
        async ack(text) {
          await call("answerCallbackQuery", { callback_query_id: cq.id, text });
          if (!allowed || !cq.message) return;
          await call("editMessageReplyMarkup", { chat_id: cq.message.chat.id, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => undefined);
          await call("sendMessage", { chat_id: cq.message.chat.id, text, reply_to_message_id: cq.message.message_id });
        },
      };
    },
  };
}
