import { getDb } from "@/db";
import { revalidatePublished } from "@/lib/revalidate";
import { adminChatFromEnv, handleApprovalPress } from "@/server/admin-chat";

// Button presses from the founder's chat app (Telegram's webhook URL; the adapter checks the secret and reads the press).
export async function POST(req: Request) {
  const chat = adminChatFromEnv();
  if (!chat) return new Response("admin chat not configured", { status: 503 });
  const press = await chat.readPress(req.headers, await req.json());
  if (press === "forbidden") return new Response("forbidden", { status: 403 });
  if (press) await handleApprovalPress(getDb(), press, ({ content }) => revalidatePublished(content));
  return Response.json({ ok: true });
}
