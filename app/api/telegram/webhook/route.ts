import { getDb } from "@/db";
import { revalidatePublished } from "@/lib/revalidate";
import { adminChatFromEnv, handlePress, sendWaitingAsks } from "@/server/admin-chat";

// Button presses from the founder's chat app (Telegram's webhook URL; the adapter checks the secret and reads the press).
export async function POST(req: Request) {
  const chat = adminChatFromEnv();
  if (!chat) return new Response("admin chat not configured", { status: 503 });
  const press = await chat.readPress(req.headers, await req.json().catch(() => null));
  if (press === "forbidden") return new Response("forbidden", { status: 403 });
  if (press) {
    const db = getDb();
    const status = await handlePress(db, press, ({ content }) => revalidatePublished(content));
    // a press on an older text: the current version goes out right away
    if (status === "stale") await sendWaitingAsks(db, chat, 3).catch(() => null);
  }
  return Response.json({ ok: true });
}
