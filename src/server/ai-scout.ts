import { and, eq, isNotNull } from "drizzle-orm";
import { type Candidate, scout, scoutEnabled } from "@/agents/ai-scout";
import { STEPS } from "@/config/process-map";
import type { Db } from "@/db";
import { lessons, organizations } from "@/db/schema";
import { runAgent } from "./agents";
import { listPackages } from "./projects";

/**
 * Monthly AI-capability scout (orchestrator job "ai.scout"). Candidates become inactive lessons in area "ai-scout";
 * Javad switches one on to adopt it, which also tells the scout not to propose it again.
 */
export async function aiScout(db: Db, now = new Date(), find: typeof scout = scout) {
  if (find === scout && !scoutEnabled()) return { skipped: "no ANTHROPIC_API_KEY" };
  const known = (await db.select({ evidence: lessons.evidence }).from(lessons).where(eq(lessons.area, "ai-scout"))).map((l) => String(l.evidence.name ?? ""));
  const packages = (await listPackages(db)).map((p) => ({ slug: p.slug, title: p.title, tasks: p.tasks.map((t) => ({ title: t.title, payEur: t.payEur })) }));
  const humanSteps = STEPS.filter((s) => s.by === "human").map((s) => ({ id: s.id, does: s.does, agentHow: s.agentHow }));
  const industries = [...new Set(await industriesOf(db))];
  const found = await runAgent(db, "ai-scout", "scout", () => find({ humanSteps, packages, industries, known }, now));
  const month = now.toISOString().slice(0, 7);
  const fresh = found.filter((c) => !known.some((k) => k.toLowerCase() === c.name.toLowerCase()));
  // proposals start switched off: nothing changes until Javad adopts one
  if (fresh.length) await db.insert(lessons).values(fresh.map((c) => ({ area: "ai-scout", text: line(c).slice(0, 1000), source: `ai-scout:${month}`, evidence: { ...c }, active: false })));
  return { candidates: fresh.length, savesEurMonth: fresh.reduce((s, c) => s + c.savesEurMonth, 0) };
}

const line = (c: Candidate) => `${c.name} (${c.released}) → ${c.replaces}: ${c.what} Cost ~€${c.costEurMonth}/month, saves ~€${c.savesEurMonth}/month. Risk: ${c.risk}. [${c.confidence}] ${c.url}`;

async function industriesOf(db: Db) {
  const rows = await db.selectDistinct({ industry: organizations.industry }).from(organizations).where(and(eq(organizations.kind, "customer"), isNotNull(organizations.industry)));
  return rows.map((r) => r.industry as string);
}
