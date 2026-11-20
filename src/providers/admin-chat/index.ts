import type { Env } from "../registry";
import { chosen } from "../registry";
import { telegramChat, telegramConfigFromEnv } from "./telegram";

/*
 * The founder's phone channel: alerts, the daily brief and approve/reject buttons. ADMIN_CHAT_PROVIDER =
 * telegram | none | mock (auto: telegram when its keys are set). Without one, everything still lands in the
 * cockpit (Needs you, Today). Approval decisions themselves are business logic (src/server/content.ts).
 */
export type ApprovalAsk = { id: string; title: string; summary?: string | null; requestedBy?: string };

/** A button press read from the provider's webhook. `ack` answers the person in the chat. */
export type ApprovalPress = { approvalId: string; decision: "approved" | "rejected"; by: string; allowed: boolean; ack: (text: string) => Promise<void> };

export type AdminChat = {
  provider: string;
  alert: (lines: string[], link?: string) => Promise<void>;
  /** sends approve/reject buttons; returns the provider's message id */
  askApproval: (a: ApprovalAsk) => Promise<string>;
  /** reads the provider's webhook: "forbidden" (bad secret), null (not a button press) or the press */
  readPress: (headers: Headers, body: unknown) => Promise<ApprovalPress | "forbidden" | null>;
  /** points the provider's button presses at our webhook (one click in the cockpit instead of a manual API call) */
  connect?: (webhookUrl: string) => Promise<void>;
};

export function mockAdminChat(): AdminChat & { sent: { lines: string[]; link?: string }[]; asked: ApprovalAsk[] } {
  const sent: { lines: string[]; link?: string }[] = [];
  const asked: ApprovalAsk[] = [];
  return {
    provider: "mock",
    sent,
    asked,
    alert: async (lines, link) => void sent.push({ lines, link }),
    askApproval: async (a) => (asked.push(a), `mock-${asked.length}`),
    readPress: async () => null,
  };
}

export function adminChatFromEnv(env: Env = process.env, fetchImpl: typeof fetch = fetch): AdminChat | null {
  switch (chosen("admin_chat", env)) {
    case "telegram": {
      const cfg = telegramConfigFromEnv(env);
      return cfg ? telegramChat(cfg, fetchImpl) : null;
    }
    case "mock":
      return mockAdminChat();
    default:
      return null;
  }
}

export { telegramChat, type TelegramConfig } from "./telegram";
