import { z } from "zod";
import { getDb } from "@/db";
import { agentStatus, recordUsage } from "@/server/agents";
import { lessonsFor } from "@/server/improve";
import { authenticateAgent, type Scope } from "@/server/api-keys";
import { errorResponse } from "@/server/http";

// Agents that run as scripts report their Claude usage here and learn whether they may continue (budget, switch).
const SCOPE: Record<string, Scope> = { "hub-research": "content:draft", "company-research": "crm:write" };
// lessons from decided experiments and Javad's rejection notes go into the agent's instructions
const AREA: Record<string, string> = { "hub-research": "content", "company-research": "outreach" };
const input = z.object({ agent: z.enum(["hub-research", "company-research"]), action: z.string().min(1).max(60), input: z.number().int().min(0), output: z.number().int().min(0), searches: z.number().int().min(0).optional(), meta: z.record(z.string(), z.unknown()).optional() });

/** GET ?agent=…: may this agent run now, and what has the company learned for it? */
export async function GET(req: Request) {
  try {
    const db = getDb();
    const agent = new URL(req.url).searchParams.get("agent") ?? "";
    await authenticateAgent(db, req.headers.get("authorization"), SCOPE[agent] ?? "content:draft");
    const s = await agentStatus(db, agent);
    const lessons = (await lessonsFor(db, AREA[agent] ?? agent)).map((l) => l.text);
    return Response.json({ allowed: s.allowed, spentEur: s.spentEur, budgetEur: s.budgetEur, lessons });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const db = getDb();
    const v = input.parse(await req.json());
    await authenticateAgent(db, req.headers.get("authorization"), SCOPE[v.agent]);
    const s = await recordUsage(db, v.agent, v.action, v, v.meta);
    return Response.json({ allowed: s.allowed, spentEur: s.spentEur, budgetEur: s.budgetEur }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
