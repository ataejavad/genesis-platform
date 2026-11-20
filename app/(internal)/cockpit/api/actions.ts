"use server";

import { requireAdmin } from "@/lib/auth";
import { telegramRecentChats } from "@/providers/admin-chat";
import { adminChatFromEnv } from "@/server/admin-chat";
import { mailerFromEnv } from "@/server/mailer";

// Proves a connection works right after its keys are set: one real email, one real phone message.
export type Result = { ok: boolean; message: string } | null;

const fail = (err: unknown): Result => ({ ok: false, message: err instanceof Error ? err.message.slice(0, 300) : "failed" });

export async function testEmail(): Promise<Result> {
  const user = await requireAdmin();
  const mailer = mailerFromEnv();
  if (!mailer) return { ok: false, message: "No email company set: add BREVO_API_KEY and MAIL_FROM, then redeploy" };
  try {
    const id = await mailer.send({ to: user.email, subject: "Genesis: test email", text: `This test email came from Genesis through ${mailer.provider}. Email works.` });
    return { ok: true, message: `Sent to ${user.email} (${mailer.provider} ${id})` };
  } catch (err) {
    return fail(err);
  }
}

/** Sends a test message and points the approve/reject buttons at this app (safe to press again). */
export async function testAdminChat(): Promise<Result> {
  await requireAdmin();
  const chat = adminChatFromEnv();
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chat && token && !process.env.TELEGRAM_ADMIN_CHAT_ID) {
    // first setup: the founder has written to the bot; show his chat id to paste into TELEGRAM_ADMIN_CHAT_ID
    try {
      const chats = await telegramRecentChats(token);
      return chats.length
        ? { ok: false, message: `Almost: set TELEGRAM_ADMIN_CHAT_ID = ${chats.map((c) => `${c.id} (${c.name})`).join(" or ")}, then redeploy and press again` }
        : { ok: false, message: "Send any message to your bot in Telegram, then press again" };
    } catch (err) {
      return fail(err);
    }
  }
  if (!chat) return { ok: false, message: "No phone channel set: add TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID, then redeploy" };
  try {
    const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
    if (chat.connect && appUrl.startsWith("https://")) await chat.connect(`${appUrl}/api/telegram/webhook`);
    await chat.alert(["✅ Genesis: test message", "Alerts, the 08:00 brief and approvals will arrive here."], "/cockpit");
    return { ok: true, message: `Sent through ${chat.provider}${chat.connect ? "; approval buttons connected" : ""}` };
  } catch (err) {
    return fail(err);
  }
}
