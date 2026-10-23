import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { approvals, events } from "@/db/schema";
import { createDraft, getPublished } from "@/server/content";
import { handleTelegramUpdate, type TelegramConfig } from "@/server/telegram";
import { dispatchBatch } from "@/worker/dispatch";
import { agent, draft, useTestDb } from "./helpers";

const db = useTestDb();
const cfg: TelegramConfig = { botToken: "T", adminChatId: "42", adminUserIds: ["7"], appUrl: "https://app.test" };

function fakeFetch() {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    const result = String(url).endsWith("/sendMessage") ? { message_id: 99, chat: { id: 42 }, ...body } : true;
    return Response.json({ ok: true, result });
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe("event dispatch and Telegram approvals", () => {
  it("sends the approval to Telegram and forwards every event to n8n", async () => {
    const r = await createDraft(db, agent, draft());
    const f = fakeFetch();
    expect(await dispatchBatch(db, { telegram: cfg, n8nWebhookUrl: "https://n8n.test/hook", fetchImpl: f })).toBe(1);
    const urls = f.mock.calls.map((c) => String(c[0]));
    expect(urls).toEqual(["https://api.telegram.org/botT/sendMessage", "https://n8n.test/hook"]);
    const sent = JSON.parse(String(f.mock.calls[0][1]!.body));
    expect(sent.reply_markup.inline_keyboard[0][0].callback_data).toBe(`apr:${r.approvalId}:a`);
    const [a] = await db.select().from(approvals).where(eq(approvals.id, r.approvalId!));
    expect(a.telegramMessageId).toBe("99");
    expect((await db.select().from(events))[0].dispatchedAt).not.toBeNull();
    expect(await dispatchBatch(db, { telegram: cfg, fetchImpl: f })).toBe(0);
  });

  it("records failures and leaves the event for retry", async () => {
    await createDraft(db, agent, draft());
    const failing = vi.fn(async () => new Response("down", { status: 500 })) as unknown as typeof fetch;
    await dispatchBatch(db, { telegram: null, n8nWebhookUrl: "https://n8n.test/hook", fetchImpl: failing });
    const [e] = await db.select().from(events);
    expect(e.dispatchedAt).toBeNull();
    expect(e.attempts).toBe(1);
    expect(e.lastError).toContain("500");
  });

  it("an admin's button press publishes the page", async () => {
    const r = await createDraft(db, agent, draft());
    const f = fakeFetch();
    const onDecided = vi.fn();
    const decision = await handleTelegramUpdate(
      db,
      cfg,
      { callback_query: { id: "cb", from: { id: 7 }, data: `apr:${r.approvalId}:a`, message: { message_id: 99, chat: { id: 42 } } } },
      f,
      onDecided,
    );
    expect(decision).toBe("approved");
    expect(onDecided).toHaveBeenCalledOnce();
    expect(await getPublished(db, "de-de", "glass/ai-quoting")).not.toBeNull();
  });

  it("ignores button presses from anyone else", async () => {
    const r = await createDraft(db, agent, draft());
    const f = fakeFetch();
    const decision = await handleTelegramUpdate(
      db,
      cfg,
      { callback_query: { id: "cb", from: { id: 666 }, data: `apr:${r.approvalId}:a` } },
      f,
    );
    expect(decision).toBeNull();
    expect(await getPublished(db, "de-de", "glass/ai-quoting")).toBeNull();
  });
});
