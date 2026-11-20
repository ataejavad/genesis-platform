import type { Env } from "../registry";
import { timingSafeEqual } from "node:crypto";
import type { AdminChat, ApprovalPress } from ".";

/*
 * Telegram bot: TELEGRAM_BOT_TOKEN, TELEGRAM_ADMIN_CHAT_ID, TELEGRAM_ADMIN_USER_IDS (who may approve),
 * TELEGRAM_WEBHOOK_SECRET (checked on /api/telegram/webhook).
 */
export type TelegramConfig = { botToken: string; adminChatId: string; adminUserIds: string[]; appUrl: string; webhookSecret?: string };

export function telegramConfigFromEnv(env: Env = process.env): TelegramConfig | null {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_ADMIN_CHAT_ID) return null;
  return {
    botToken: env.TELEGRAM_BOT_TOKEN,
    adminChatId: env.TELEGRAM_ADMIN_CHAT_ID,
    adminUserIds: (env.TELEGRAM_ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    appUrl: env.APP_URL ?? "",
    webhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
  };
}

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
    async readPress(headers, body): Promise<ApprovalPress | "forbidden" | null> {
      if (!secretMatches(headers.get("x-telegram-bot-api-secret-token"), cfg.webhookSecret)) return "forbidden";
      const cq = (body as { callback_query?: CallbackQuery })?.callback_query;
      const match = cq?.data?.match(/^apr:([0-9a-f-]{36}):([ar])$/);
      if (!cq || !match) return null;
      const allowed = cfg.adminUserIds.includes(String(cq.from.id));
      return {
        approvalId: match[1],
        decision: match[2] === "a" ? "approved" : "rejected",
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
