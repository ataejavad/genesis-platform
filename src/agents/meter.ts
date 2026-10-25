import { AsyncLocalStorage } from "node:async_hooks";

/*
 * Token metering for Claude calls. An agent reports `message.usage` after each call; the server's runAgent()
 * collects it and writes one agent_runs row with the € cost. Outside runAgent (tests, scripts) it is a no-op.
 */

export type Usage = { input: number; output: number; searches: number };
type ApiUsage = { input_tokens: number; output_tokens: number; server_tool_use?: { web_search_requests?: number | null } | null };

const store = new AsyncLocalStorage<Usage>();

export function meter(u: ApiUsage | undefined | null) {
  const s = store.getStore();
  if (!s || !u) return;
  s.input += u.input_tokens;
  s.output += u.output_tokens;
  s.searches += u.server_tool_use?.web_search_requests ?? 0;
}

/** Runs fn and adds its Claude usage to `usage` (also when fn throws, so a failed call still shows its cost). */
export async function metered<T>(fn: () => Promise<T>, usage: Usage = { input: 0, output: 0, searches: 0 }): Promise<{ result: T; usage: Usage }> {
  const result = await store.run(usage, fn);
  return { result, usage };
}

// € per million tokens (Opus 5.5 list price; override with env when prices change) and per web search.
const PRICE = { in: Number(process.env.CLAUDE_EUR_PER_MTOK_IN ?? 5), out: Number(process.env.CLAUDE_EUR_PER_MTOK_OUT ?? 25), search: 0.01 };
export const costEur = (u: Usage) => (u.input * PRICE.in + u.output * PRICE.out) / 1e6 + u.searches * PRICE.search;
