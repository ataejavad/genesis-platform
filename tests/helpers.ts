import { sql } from "drizzle-orm";
import { afterAll, beforeEach } from "vitest";
import { createDb } from "@/db";

export function useTestDb() {
  const db = createDb(process.env.TEST_DATABASE_URL!, 5);
  beforeEach(async () => {
    await db.execute(sql`truncate content_items, approvals, events, audit_log, agent_runs, api_keys, markets, leads, checkups, prospects, contacts, touches, company_pages, inbox, channel_switches, organizations, "user" cascade`);
  });
  afterAll(() => db.$client.end());
  return db;
}

export const agent = { type: "agent", id: "content-agent", apiKeyId: "00000000-0000-0000-0000-000000000000" } as const;
export const javad = { type: "user", id: "javad" } as const;

export const draft = (over: Record<string, unknown> = {}) => ({
  locale: "de-de",
  slug: "glass/ai-quoting",
  title: "KI-Angebote für Glasereien",
  summary: "Angebote in Minuten statt Tagen",
  body: "# Hallo\n\nText v1",
  ...over,
});
