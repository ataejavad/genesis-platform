import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { approvals } from "@/db/schema";
import type { AdminChat, ApprovalAsk, ApprovalPress } from "@/providers/admin-chat";
import { decideApproval } from "./content";
import { AppError } from "./errors";

/*
 * Approvals and alerts on the founder's phone. Which app carries them (Telegram today) is the AdminChat adapter
 * from src/providers/admin-chat (ADMIN_CHAT_PROVIDER); this file only holds what we do with them.
 */
export { type AdminChat, adminChatFromEnv } from "@/providers/admin-chat";

/** Speed-to-lead alert (target: answer inbound within 5 minutes). */
export async function sendAlert(chat: AdminChat, lines: string[], link?: string) {
  await chat.alert(lines, link);
}

export async function sendApprovalRequest(db: Db, chat: AdminChat, approval: ApprovalAsk) {
  const messageId = await chat.askApproval(approval);
  await db.update(approvals).set({ telegramMessageId: messageId }).where(eq(approvals.id, approval.id));
}

/** A button press from the chat. Returns the decision that was applied, or null if it was ignored. */
export async function handleApprovalPress(db: Db, press: ApprovalPress, onDecided?: (result: Awaited<ReturnType<typeof decideApproval>>) => Promise<void> | void) {
  if (!press.allowed) {
    await press.ack("اجازه تأیید ندارید");
    return null;
  }
  let answer: string;
  try {
    const result = await decideApproval(db, { type: "telegram", id: press.by }, press.approvalId, press.decision);
    await onDecided?.(result);
    answer = press.decision === "approved" ? "منتشر شد ✅" : "رد شد ❌";
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    answer = err.code === "conflict" ? "قبلاً تصمیم گرفته شده" : err.message;
  }
  await press.ack(answer);
  return press.decision;
}
