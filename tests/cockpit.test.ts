import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { meter } from "@/agents/meter";
import { AGENTS } from "@/config/agents";
import { MODULES } from "@/config/modules";
import { events, jobRuns, touches } from "@/db/schema";
import { runAgent } from "@/server/agents";
import { decideFilter, marketFilters, pausedFilters } from "@/server/market-filters";
import { needsYou } from "@/server/needs-you";
import { JOBS, runDue } from "@/server/orchestrator";
import { isStopped, setSwitch, STOP } from "@/server/switches";
import { connections, systemsBoard } from "@/server/systems";
import { javad, useTestDb } from "./helpers";

const db = useTestDb();
const deps = { mailer: null, voice: null, telegram: null };

describe("cockpit wiring", () => {
  it("every row of docs/cockpit-wiring.md is a module, and every module points at a real agent or job", () => {
    const rows = [...readFileSync("docs/cockpit-wiring.md", "utf8").matchAll(/^\| (\d+) \|/gm)].map((m) => Number(m[1]));
    const folded = new Set([8, 23]);
    const have = new Set(MODULES.map((m) => m.n));
    expect(rows.filter((n) => !folded.has(n) && !have.has(n))).toEqual([]);
    expect(new Set(MODULES.map((m) => m.n)).size).toBe(MODULES.length);
    for (const m of MODULES) {
      if (m.agent) expect(AGENTS.map((a) => a.id), m.name).toContain(m.agent);
      if (m.job) expect(JOBS.map((j) => j.id), m.name).toContain(m.job);
    }
    // every agent and every job is visible somewhere in Systems
    for (const a of AGENTS) expect(MODULES.some((m) => m.agent === a.id), a.id).toBe(true);
    for (const j of JOBS) expect(MODULES.some((m) => m.job === j.id), j.id).toBe(true);
  });

  it("shows every module with a status, and a module waits when its key is missing", async () => {
    const board = await systemsBoard(db, new Date(), {} as unknown as NodeJS.ProcessEnv);
    const rows = board.systems.flatMap((s) => s.rows);
    expect(rows.length).toBe(MODULES.length);
    expect(rows.filter((r) => r.kpiText.startsWith("error"))).toEqual([]);
    expect(rows.find((r) => r.n === 39)).toMatchObject({ status: "key", why: "waiting for ANTHROPIC_API_KEY" });
    const withKeys = await systemsBoard(db, new Date(), { ANTHROPIC_API_KEY: "x" } as unknown as NodeJS.ProcessEnv);
    expect(withKeys.systems.flatMap((s) => s.rows).find((r) => r.n === 39)?.status).toBe("live");
    expect(connections({ BREVO_API_KEY: "k" } as unknown as NodeJS.ProcessEnv).find((c) => c.name.startsWith("Brevo"))?.ok).toBe(false);
  });
});

describe("switches", () => {
  it("the emergency stop holds every agent and every outward job, and is announced", async () => {
    await setSwitch(db, javad, STOP, true, "test");
    expect(await isStopped(db)).toBe(true);
    await expect(runAgent(db, "portal-advisor", "answer", async () => (meter({ input_tokens: 1, output_tokens: 1 }), "x"))).rejects.toMatchObject({ code: "agent_paused" });
    const ran = await runDue(db, deps, new Date("2026-11-01T08:10:00Z"));
    expect(ran.map((r) => r.job)).not.toContain("outreach.send");
    expect(ran.map((r) => r.job)).not.toContain("lead.reminders");
    expect(ran.map((r) => r.job)).toContain("ops.watch");
    expect((await systemsBoard(db)).systems.flatMap((s) => s.rows).find((r) => r.n === 19)?.status).toBe("stopped");
    expect((await db.select().from(events)).some((e) => e.type === "switch.changed" && e.payload.id === STOP)).toBe(true);
    await setSwitch(db, javad, STOP, false);
    expect(await runAgent(db, "portal-advisor", "answer", async () => "x")).toBe("x");
  });

  it("a job switched off is skipped", async () => {
    await setSwitch(db, javad, "job:money", false);
    const ran = await runDue(db, deps, new Date("2026-11-01T08:10:00Z"));
    expect(ran.map((r) => r.job)).not.toContain("money");
    expect((await db.select().from(jobRuns)).some((r) => r.job === "money")).toBe(false);
  });

  it("market filters come from the latest run and Javad's pause reaches the company finder", async () => {
    const [it0] = await marketFilters(db, ["IT"]);
    expect(it0.rows.length).toBeGreaterThan(3);
    expect(it0.rows[0].decision).toBe("undecided");
    await decideFilter(db, javad, "IT", "F43.22", false);
    expect(await pausedFilters(db)).toEqual(["filter:IT:F43"]);
    expect((await marketFilters(db, ["IT"]))[0].rows.find((r) => r.id === "F43")?.decision).toBe("paused");
  });
});

describe("needs you", () => {
  it("collects what waits for Javad from every module", async () => {
    expect(await needsYou(db)).toEqual([]);
    const { prospects } = await import("@/db/schema");
    const [p] = await db.insert(prospects).values({ key: "x.it", name: "X", industry: "metal", country: "IT", source: "maps" }).returning();
    await db.insert(touches).values({ prospectId: p.id, step: "email-1", position: 0, channel: "email", locale: "it-it", subject: "s", body: "b", dueAt: new Date() });
    expect(await needsYou(db)).toMatchObject([{ id: "outreach", n: 1, link: "/cockpit/outreach" }]);
  });
});
