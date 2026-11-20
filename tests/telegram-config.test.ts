import { describe, expect, it, vi } from "vitest";
import { telegramChat, telegramConfigFromEnv } from "@/providers/admin-chat/telegram";

// The founder sets only the bot token and his chat id; approver and webhook secret follow from them.
describe("Telegram setup from two values", () => {
  it("uses the private chat id as approver and a stable secret derived from the token", () => {
    const cfg = telegramConfigFromEnv({ TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_ADMIN_CHAT_ID: "42", APP_URL: "https://app.test" })!;
    expect(cfg.adminUserIds).toEqual(["42"]);
    expect(cfg.webhookSecret).toMatch(/^[0-9a-f]{48}$/);
    expect(telegramConfigFromEnv({ TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_ADMIN_CHAT_ID: "42", TELEGRAM_WEBHOOK_SECRET: "CHANGE_ME" })!.webhookSecret).toBe(cfg.webhookSecret);
    expect(telegramConfigFromEnv({ TELEGRAM_BOT_TOKEN: "123:abc", TELEGRAM_ADMIN_CHAT_ID: "42", TELEGRAM_WEBHOOK_SECRET: "mine", TELEGRAM_ADMIN_USER_IDS: "7, 8" })).toMatchObject({ webhookSecret: "mine", adminUserIds: ["7", "8"] });
  });

  it("connect() registers the webhook with that secret, and presses carrying it are accepted", async () => {
    const cfg = telegramConfigFromEnv({ TELEGRAM_BOT_TOKEN: "T", TELEGRAM_ADMIN_CHAT_ID: "42" })!;
    const f = vi.fn(async () => Response.json({ ok: true, result: true })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
    const chat = telegramChat(cfg, f);
    await chat.connect!("https://app.test/api/telegram/webhook");
    expect(String(f.mock.calls[0][0])).toBe("https://api.telegram.org/botT/setWebhook");
    const sent = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(sent).toMatchObject({ url: "https://app.test/api/telegram/webhook", secret_token: cfg.webhookSecret });
    expect(await chat.readPress(new Headers({ "x-telegram-bot-api-secret-token": cfg.webhookSecret! }), {})).toBeNull();
    expect(await chat.readPress(new Headers({ "x-telegram-bot-api-secret-token": "wrong" }), {})).toBe("forbidden");
  });
});
