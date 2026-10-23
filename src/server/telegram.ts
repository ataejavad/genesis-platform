import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { approvals } from "@/db/schema";
import { decideApproval } from "./content";
import { AppError } from "./errors";

export type TelegramConfig = {
  botToken: string;
  adminChatId: string;
  adminUserIds: string[];
  appUrl: string;
};

type Fetch = typeof fetch;

export function telegramConfigFromEnv(env = process.env): TelegramConfig | null {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_ADMIN_CHAT_ID) return null;
  return {
    botToken: env.TELEGRAM_BOT_TOKEN,
    adminChatId: env.TELEGRAM_ADMIN_CHAT_ID,
    adminUserIds: (env.TELEGRAM_ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    appUrl: env.APP_URL ?? "",
  };
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function call(cfg: TelegramConfig, method: string, body: unknown, fetchImpl: Fetch = fetch) {
  const res = await fetchImpl(`https://api.telegram.org/bot${cfg.botToken}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result?: any; description?: string };
  if (!json.ok) throw new Error(`telegram ${method}: ${json.description ?? res.status}`);
  return json.result;
}

/** Speed-to-lead alert (target: answer inbound within 5 minutes). */
export async function sendAlert(cfg: TelegramConfig, lines: string[], link?: string, fetchImpl: Fetch = fetch) {
  const text = [...lines.map(escapeHtml), link && cfg.appUrl ? `<a href="${cfg.appUrl}${link}">باز کردن</a>` : ""].filter(Boolean).join("\n");
  await call(cfg, "sendMessage", { chat_id: cfg.adminChatId, text, parse_mode: "HTML" }, fetchImpl);
}

export async function sendApprovalRequest(
  db: Db,
  cfg: TelegramConfig,
  approval: { id: string; title: string; summary?: string | null; requestedBy?: string },
  fetchImpl: Fetch = fetch,
) {
  const text = [
    "🟡 <b>درخواست تأیید</b>",
    `<b>${escapeHtml(approval.title)}</b>`,
    approval.summary ? escapeHtml(approval.summary) : "",
    approval.requestedBy ? `از طرف: <code>${escapeHtml(approval.requestedBy)}</code>` : "",
    cfg.appUrl ? `<a href="${cfg.appUrl}/cockpit">باز کردن کابین</a>` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const msg = await call(
    cfg,
    "sendMessage",
    {
      chat_id: cfg.adminChatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "✅ تأیید و انتشار", callback_data: `apr:${approval.id}:a` },
            { text: "❌ رد", callback_data: `apr:${approval.id}:r` },
          ],
        ],
      },
    },
    fetchImpl,
  );
  await db.update(approvals).set({ telegramMessageId: String(msg.message_id) }).where(eq(approvals.id, approval.id));
}

type CallbackQuery = {
  id: string;
  from: { id: number; username?: string };
  data?: string;
  message?: { message_id: number; chat: { id: number }; text?: string };
};

/** Handles a button press. Returns the decision that was applied, or null if the update was ignored. */
export async function handleTelegramUpdate(
  db: Db,
  cfg: TelegramConfig,
  update: { callback_query?: CallbackQuery },
  fetchImpl: Fetch = fetch,
  onDecided?: (result: Awaited<ReturnType<typeof decideApproval>>) => Promise<void> | void,
) {
  const cq = update.callback_query;
  const match = cq?.data?.match(/^apr:([0-9a-f-]{36}):([ar])$/);
  if (!cq || !match) return null;

  if (!cfg.adminUserIds.includes(String(cq.from.id))) {
    await call(cfg, "answerCallbackQuery", { callback_query_id: cq.id, text: "اجازه تأیید ندارید" }, fetchImpl);
    return null;
  }

  const decision = match[2] === "a" ? "approved" : "rejected";
  let answer: string;
  try {
    const result = await decideApproval(db, { type: "telegram", id: String(cq.from.id) }, match[1], decision);
    await onDecided?.(result);
    answer = decision === "approved" ? "منتشر شد ✅" : "رد شد ❌";
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    answer = err.code === "conflict" ? "قبلاً تصمیم گرفته شده" : err.message;
  }

  await call(cfg, "answerCallbackQuery", { callback_query_id: cq.id, text: answer }, fetchImpl);
  if (cq.message) {
    await call(
      cfg,
      "editMessageReplyMarkup",
      { chat_id: cq.message.chat.id, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } },
      fetchImpl,
    ).catch(() => undefined);
    await call(cfg, "sendMessage", { chat_id: cq.message.chat.id, text: answer, reply_to_message_id: cq.message.message_id }, fetchImpl);
  }
  return decision;
}
