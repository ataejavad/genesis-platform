import type { Env } from "../registry";
import { chosen } from "../registry";
import { telegramChat, telegramConfigFromEnv } from "./telegram";

/*
 * The founder's phone channel: alerts, the daily brief and approve/reject buttons. ADMIN_CHAT_PROVIDER =
 * telegram | none | mock (auto: telegram when its keys are set). Without one, everything still lands in the
 * cockpit (Needs you, Today). Approval decisions themselves are business logic (src/server/content.ts).
 */
export type ApprovalAsk = { id: string; title: string; summary?: string | null; requestedBy?: string };

/**
 * Any other yes/no decision for the founder (outbound first message, partner application, finished test). `ref` is
 * our own ask id; the press comes back with it. `link` opens the item in the cockpit (edit before deciding).
 */
export type DecisionAsk = { ref: string; title: string; lines: string[]; approveLabel: string; rejectLabel: string; link?: string; linkLabel?: string };

/**
 * A button press read from the provider's webhook. `target` says which kind of ask it answers: a content approval
 * (`id` = approval id) or a decision ask (`id` = ask ref). `ack` answers the person in the chat.
 */
export type ApprovalPress = { target: "approval" | "ask"; id: string; decision: "approved" | "rejected"; by: string; allowed: boolean; ack: (text: string) => Promise<void> };

export type AdminChatStatus = { connected: boolean; url?: string; pending?: number; lastError?: string | null };

export type AdminChat = {
  provider: string;
  alert: (lines: string[], link?: string) => Promise<void>;
  /** sends approve/reject buttons for a content draft; returns the provider's message id */
  askApproval: (a: ApprovalAsk) => Promise<string>;
  /** sends approve/reject buttons for any other decision; returns the provider's message id */
  askDecision: (a: DecisionAsk) => Promise<string>;
  /** reads the provider's webhook: "forbidden" (bad secret), null (not a button press) or the press */
  readPress: (headers: Headers, body: unknown) => Promise<ApprovalPress | "forbidden" | null>;
  /** points the provider's button presses at our webhook (one click in the cockpit instead of a manual API call) */
  connect?: (webhookUrl: string) => Promise<void>;
  /** whether button presses reach us (cockpit status) */
  status?: () => Promise<AdminChatStatus>;
};

export function mockAdminChat(): AdminChat & { sent: { lines: string[]; link?: string }[]; asked: ApprovalAsk[]; decisions: DecisionAsk[] } {
  const sent: { lines: string[]; link?: string }[] = [];
  const asked: ApprovalAsk[] = [];
  const decisions: DecisionAsk[] = [];
  return {
    provider: "mock",
    sent,
    asked,
    decisions,
    alert: async (lines, link) => void sent.push({ lines, link }),
    askApproval: async (a) => (asked.push(a), `mock-${asked.length}`),
    askDecision: async (a) => (decisions.push(a), `mock-d${decisions.length}`),
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

export { telegramChat, telegramRecentChats, type TelegramConfig } from "./telegram";
