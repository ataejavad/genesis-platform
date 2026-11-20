import type { Usage } from "@/agents/meter";

export type LlmMessage = { role: "user" | "assistant"; content: string };

/** Our own request shape. Adapters map it to their vendor and ignore what they cannot do (effort, thinking). */
export type LlmRequest = {
  system?: string;
  messages: LlmMessage[];
  maxTokens: number;
  /** how hard the model should think; adapters translate or ignore */
  effort?: "low" | "medium" | "high";
  thinking?: boolean;
  /** server-side web search with at most this many searches (only providers with webSearch) */
  webSearch?: { maxUses: number };
  timeoutMs?: number;
};

export type LlmResult = { text: string; stop: "end" | "refusal" | "max_tokens"; usage: Usage; model: string };

export type Llm = {
  provider: string;
  model: string;
  webSearch: boolean;
  complete: (req: LlmRequest) => Promise<LlmResult>;
};
