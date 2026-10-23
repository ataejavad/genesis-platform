import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/db";
import { revalidatePublished } from "@/lib/revalidate";
import { handleTelegramUpdate, telegramConfigFromEnv } from "@/server/telegram";

function secretMatches(given: string | null, expected: string | undefined) {
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!secretMatches(req.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_WEBHOOK_SECRET)) {
    return new Response("forbidden", { status: 403 });
  }
  const cfg = telegramConfigFromEnv();
  if (!cfg) return new Response("telegram not configured", { status: 503 });
  await handleTelegramUpdate(getDb(), cfg, await req.json(), fetch, ({ content }) => revalidatePublished(content));
  return Response.json({ ok: true });
}
