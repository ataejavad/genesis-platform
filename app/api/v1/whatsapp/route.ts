import { agentReply, whatsappAgentEnabled } from "@/agents/whatsapp-agent";
import { getDb } from "@/db";
import { whatsappFromEnv } from "@/providers/whatsapp";
import { runAgent } from "@/server/agents";
import { errorResponse } from "@/server/http";
import { handleWhatsApp } from "@/server/whatsapp";

// The provider's one-time webhook check (Meta: GET with hub.challenge when it is connected in the app settings).
export async function GET(req: Request) {
  return whatsappFromEnv()?.handshake(new URL(req.url)) ?? new Response("forbidden", { status: 403 });
}

// Every customer message: stored, linked to the company, answered by the agent, Javad alerted.
export async function POST(req: Request) {
  try {
    const channel = whatsappFromEnv();
    if (!channel) return new Response("not configured", { status: 404 });
    const raw = await req.text();
    if (!channel.verify(raw, req.headers)) return new Response("bad signature", { status: 401 });
    const db = getDb();
    return Response.json(await handleWhatsApp(db, channel, JSON.parse(raw), whatsappAgentEnabled() ? (x) => runAgent(db, "whatsapp-agent", "reply", () => agentReply(x)) : null));
  } catch (err) {
    return errorResponse(err);
  }
}
