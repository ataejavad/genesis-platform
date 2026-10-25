import { claudeReply, whatsappAgentEnabled } from "@/agents/whatsapp-agent";
import { getDb } from "@/db";
import { runAgent } from "@/server/agents";
import { errorResponse } from "@/server/http";
import { handleWhatsApp, validSignature, whatsappFromEnv } from "@/server/whatsapp";

// Meta checks the webhook once with a GET (hub.challenge) when it is connected in the WhatsApp app settings.
export async function GET(req: Request) {
  const cfg = whatsappFromEnv();
  const q = new URL(req.url).searchParams;
  if (cfg && q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === cfg.verifyToken) return new Response(q.get("hub.challenge") ?? "");
  return new Response("forbidden", { status: 403 });
}

// Every customer message: stored, linked to the company, answered by the agent, Javad alerted.
export async function POST(req: Request) {
  try {
    const cfg = whatsappFromEnv();
    if (!cfg) return new Response("not configured", { status: 404 });
    const raw = await req.text();
    if (!validSignature(raw, req.headers.get("x-hub-signature-256"), cfg.appSecret)) return new Response("bad signature", { status: 401 });
    const db = getDb();
    return Response.json(await handleWhatsApp(db, cfg, JSON.parse(raw), whatsappAgentEnabled() ? (x) => runAgent(db, "whatsapp-agent", "reply", () => claudeReply(x)) : null));
  } catch (err) {
    return errorResponse(err);
  }
}
