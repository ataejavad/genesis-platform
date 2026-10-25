import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { meter } from "@/agents/meter";
import { agentRuns, customerHealth, events, experimentSubjects, invoices, jobRuns, leads, lessons, notifications, prospects, reports } from "@/db/schema";
import { agentBoard, agentStatus, checkBudgets, runAgent, setAgent } from "@/server/agents";
import { createDraft, decideApproval } from "@/server/content";
import { addProspect, setStage } from "@/server/crm";
import { buildBrief, dailyReport } from "@/server/daily-report";
import { askForStory, customerHealthWeek, monthlyResults, weekKey } from "@/server/health";
import type { HubResearch } from "@/server/hubs";
import { checkExperiments, decideExperiment, ensureExperiments, lessonsFor, recordOutcome, startExperiment, variantFor, verdict } from "@/server/improve";
import { leadReminders } from "@/server/lead-reminders";
import { leadUnsubscribeUrl, notifyEvent, unsubscribeLeadLink } from "@/server/notify";
import { isDue, JOBS, lastSlot, romeInstant, runDue } from "@/server/orchestrator";
import { addSubscription, createCustomer } from "@/server/portal";
import { retention } from "@/server/retention";
import { agent, draft, javad, useTestDb } from "./helpers";

const db = useTestDb();
const sys = { type: "system", id: "test" } as const;
const DAY = 864e5;
const deps = { mailer: null, voice: null, telegram: null };

async function customer(name = "Rossi Impianti", email = "m@rossi.test") {
  const c = await db.transaction((tx) => createCustomer(tx, sys, { name, country: "IT", industry: "installers", locale: "it", baselineEur: 4000, email, contactName: "Marco" }, "a-long-test-password"));
  await db.transaction((tx) => addSubscription(tx, sys, c.org.id, "phone-agent", "Standard", 390, new Date("2026-08-01")));
  return c;
}

describe("orchestrator schedule (Rome time)", () => {
  it("finds the last daily, weekly and monthly slot across the DST change", () => {
    // 2026-10-25 is the night Italy goes from UTC+2 to UTC+1
    expect(romeInstant("2026-10-24", "08:00").toISOString()).toBe("2026-10-24T06:00:00.000Z");
    expect(romeInstant("2026-10-26", "08:00").toISOString()).toBe("2026-10-26T07:00:00.000Z");
    const at = new Date("2026-10-26T06:30:00Z"); // 07:30 Monday in Rome
    expect(lastSlot({ daily: "08:00" }, at)!.toISOString()).toBe("2026-10-25T07:00:00.000Z");
    expect(lastSlot({ weekly: 1, at: "07:00" }, at)!.toISOString()).toBe("2026-10-26T06:00:00.000Z");
    expect(lastSlot({ monthly: 1, at: "09:00" }, at)!.toISOString()).toBe("2026-10-01T07:00:00.000Z");
  });

  it("is due once per slot, retries a failure after 15 minutes, and a fresh install does not replay old months", () => {
    const daily = JOBS.find((j) => j.id === "daily.report")!;
    const monthly = JOBS.find((j) => j.id === "results.monthly")!;
    const at = new Date("2026-10-26T07:05:00Z"); // 08:05 Rome
    expect(isDue(daily, undefined, at)).toBe(true);
    expect(isDue(daily, { startedAt: new Date("2026-10-26T07:00:30Z"), ok: true }, at)).toBe(false);
    expect(isDue(daily, { startedAt: new Date("2026-10-25T07:00:30Z"), ok: true }, at)).toBe(true);
    expect(isDue(daily, { startedAt: new Date("2026-10-26T06:49:00Z"), ok: false }, at)).toBe(true);
    expect(isDue(monthly, undefined, at)).toBe(false);
  });

  it("runs every due job, records each run, and nothing is due right after", async () => {
    const now = new Date("2026-11-01T08:10:00Z"); // Sunday, 09:10 Rome on the 1st
    const ran = await runDue(db, deps, now);
    expect(ran.every((r) => r.ok)).toBe(true);
    expect(ran.map((r) => r.job)).toEqual(expect.arrayContaining(["outreach.send", "ops.watch", "money", "agents.budget", "daily.report", "results.monthly", "data.retention", "experiments", "lead.reminders"]));
    expect((await db.select().from(jobRuns)).length).toBe(ran.length);
    expect(await runDue(db, deps, new Date(now.getTime() + 60_000))).toEqual([]);
    expect((await db.select().from(reports)).length).toBe(1);
  });
});

describe("agents: budget and KPI", () => {
  it("meters every call, pauses at the budget until the 1st, and Javad can resume", async () => {
    // 1M input tokens = €5
    const call = () => runAgent(db, "portal-advisor", "answer", async () => (meter({ input_tokens: 1_000_000, output_tokens: 0 }), "ok"));
    expect(await call()).toBe("ok");
    const [run] = await db.select().from(agentRuns);
    expect(Number(run.costEur)).toBe(5);
    await setAgent(db, javad, "portal-advisor", { budgetEur: 8 });
    await call();
    expect(await checkBudgets(db)).toEqual(["portal-advisor"]);
    expect((await agentStatus(db, "portal-advisor")).paused).toBe(true);
    await expect(call()).rejects.toMatchObject({ status: 423 });
    expect((await db.select().from(events)).map((e) => e.type)).toContain("agent.paused");
    await setAgent(db, javad, "portal-advisor", { resume: true, budgetEur: 50 });
    expect(await call()).toBe("ok");
    await setAgent(db, javad, "portal-advisor", { enabled: false });
    await expect(call()).rejects.toMatchObject({ code: "agent_paused" });
  });

  it("a failed call is recorded as failed and still costs what it used", async () => {
    await expect(runAgent(db, "qa-judge", "judge", async () => (meter({ input_tokens: 2000, output_tokens: 100 }), Promise.reject(new Error("boom"))))).rejects.toThrow("boom");
    const [run] = await db.select().from(agentRuns);
    expect(run.ok).toBe(false);
    expect(run.inputTokens).toBe(2000);
  });

  it("asks Javad to keep or stop an agent that missed its KPI two weeks in a row while spending", async () => {
    const now = new Date();
    // WhatsApp agent: €3 per conversation vs target €0.5, in both windows
    for (const days of [3, 17]) await db.insert(agentRuns).values({ agent: "whatsapp-agent", action: "reply", inputTokens: 0, outputTokens: 0, costEur: "3", createdAt: new Date(now.getTime() - days * DAY) });
    const { inbox } = await import("@/db/schema");
    for (const days of [3, 17]) await db.insert(inbox).values({ channel: "whatsapp", direction: "in", party: `+39${days}`, body: "ciao", createdAt: new Date(now.getTime() - days * DAY) });
    const wa = (await agentBoard(db, now)).find((a) => a.def.id === "whatsapp-agent")!;
    expect(wa.kpi).toMatchObject({ value: 3, met: false });
    expect(wa.decision).toMatch(/Keep, change or stop/);
    expect((await buildBrief(db, now)).decisions.map((d) => d.text).join(" ")).toMatch(/WhatsApp agent/);
  });
});

describe("improvement loop", () => {
  it("a variant wins only with a clear lead and no worse guardrail", () => {
    const arm = (id: string, n: number, s: number, g = 0) => ({ id, description: id, n, successes: s, rate: s / n, guardrailRate: g });
    expect(verdict([arm("a", 100, 5), arm("b", 100, 15)]).winner).toBe("b");
    expect(verdict([arm("a", 100, 5), arm("b", 100, 8)]).winner).toBe("a"); // not significant
    expect(verdict([arm("a", 100, 5), arm("b", 100, 15, 0.08)]).winner).toBe("a"); // more opt-outs
  });

  it("assigns subjects for good, records outcomes once, marks the test ready, and stores the lesson", async () => {
    const e = await startExperiment(db, javad, { key: "test.subject", area: "outreach", hypothesis: "h", metric: "replies", variants: [{ id: "a", description: "old" }, { id: "b", description: "new" }], minSample: 3, windowDays: 7 });
    const ids = Array.from({ length: 40 }, (_, i) => `s${i}`);
    const got = new Map<string, string>();
    for (const id of ids) got.set(id, (await variantFor(db, "test.subject", id))!);
    expect(await variantFor(db, "test.subject", "s1")).toBe(got.get("s1"));
    for (const id of ids) if (got.get(id) === "b") await recordOutcome(db, "test.subject", id, { success: true });
    await recordOutcome(db, "test.subject", "s0", { success: false });
    const later = new Date(Date.now() + 8 * DAY); // the rest run out of time: failures
    expect(await checkExperiments(db, later)).toEqual(["test.subject"]);
    expect((await db.select().from(events)).map((x) => x.type)).toContain("experiment.ready");
    const r = await decideExperiment(db, javad, e.id, true, "short lines work", later);
    expect(r).toEqual({ status: "adopted", winner: "b" });
    expect(await variantFor(db, "test.subject", "new-one")).toBe("b");
    const [l] = await lessonsFor(db, "outreach");
    expect(l.text).toMatch(/"new" works better.*short lines work/);
  });

  it("the outreach opening test splits researched companies and counts a reply as success", async () => {
    await ensureExperiments(db);
    const env = { appUrl: "https://lp.test", sender: "Javad", brand: "Legend Partner" };
    const finder = { type: "agent", id: "company-finder", apiKeyId: "00000000-0000-0000-0000-000000000000" } as const;
    const base = { industry: "metal", country: "it", city: "Brescia", source: "maps", signals: {}, criterionScores: { fit: 9, need: 6, reach: 2 }, contacts: [{ name: "Marco Rossi", role: "Titolare", email: "marco@x.it", source: "apollo" }], personal: { local: "Ho visto il vostro nuovo capannone.", fa: "سوله جدید" } };
    for (let i = 0; i < 12; i++) await addProspect(db, finder, { ...base, name: `Officina ${i}`, website: `https://officina${i}.it` }, env);
    const subs = await db.select().from(experimentSubjects);
    expect(subs.length).toBe(12);
    expect(new Set(subs.map((s) => s.variant))).toEqual(new Set(["signal", "research"]));
    const [p] = await db.select().from(prospects).where(eq(prospects.id, subs[0].subjectId));
    await setStage(db, javad, p.id, "contacted");
    await setStage(db, javad, p.id, "replied");
    const [s] = await db.select().from(experimentSubjects).where(eq(experimentSubjects.subjectId, p.id));
    expect(s.success).toBe(true);
  });

  it("Javad's rejection note becomes a content lesson", async () => {
    const r = await createDraft(db, agent, draft());
    await decideApproval(db, javad, r.approvalId!, "rejected", "Too long, cite the ministry");
    const [l] = await db.select().from(lessons);
    expect(l).toMatchObject({ area: "content" });
    expect(l.text).toMatch(/cite the ministry/);
  });
});

describe("customers: health, monthly results, story", () => {
  it("scores a customer with no results and overdue money red once, and lists it in the brief", async () => {
    const c = await customer();
    const now = new Date();
    await db.insert(invoices).values({ orgId: c.org.id, kind: "subscription", title: "October", netEur: 390, vatRate: 22, vatEur: 85.8, totalEur: 475.8, reference: "LP-T1", dueAt: new Date(now.getTime() - 5 * DAY) });
    expect(await customerHealthWeek(db, now)).toMatchObject({ scored: 1, red: 1 });
    await customerHealthWeek(db, now);
    const [h] = await db.select().from(customerHealth);
    expect(h.week).toBe(weekKey(now));
    expect(h.score).toBeLessThan(40);
    expect((await db.select().from(events).where(eq(events.type, "customer.at_risk"))).length).toBe(1);
    expect((await buildBrief(db, now)).decisions.some((d) => d.text.includes("Rossi Impianti"))).toBe(true);
  });

  it("reports last month's results once, in the customer's language", async () => {
    await customer();
    const now = new Date("2026-11-01T08:00:00Z");
    expect(await monthlyResults(db, now)).toEqual({ month: "2026-10", sent: 1 });
    expect((await monthlyResults(db, now)).sent).toBe(0);
    const [e] = await db.select().from(events).where(eq(events.type, "results.reported"));
    await notifyEvent(db, e);
    const [n] = await db.select().from(notifications).where(eq(notifications.template, "monthlyReport"));
    expect(n.subject).toMatch(/ottobre 2026/);
  });

  it("asks for a success story once after a project", async () => {
    const c = await customer();
    const { projects } = await import("@/db/schema");
    const [p] = await db.insert(projects).values({ code: "P-9001", orgId: c.org.id, title: "x", risk: "low", priceEur: 1000, budgetEur: 500, dueAt: new Date(), createdBy: "test" }).returning();
    expect((await askForStory(db, p.id))?.title).toMatch(/raccontare/);
    expect(await askForStory(db, p.id)).toBeNull();
  });
});

describe("leads: reminders and retention", () => {
  const research = (date: string) =>
    [{ industry: "installers", country: "IT", deadlines: [{ id: "fgas", tags: ["fgas"], date, title: { it: "Registro F-gas", en: "F-gas register", fa: "ثبت" }, what: { it: "Dichiarazione annuale", en: "Annual statement", fa: "-" }, offer: { it: "La prepariamo noi", en: "We prepare it", fa: "-" }, sources: [] }] }] as unknown as HubResearch[];
  const lead = (over: Partial<typeof leads.$inferInsert> = {}) => db.insert(leads).values({ email: "a@b.it", industry: "installers", country: "IT", locale: "it", hook: "scadenzario", tags: ["fgas"], consentText: "ok", consentAt: new Date(), reminders: true, confirmedAt: new Date(), ...over }).returning();

  it("reminds a confirmed lead 30 days before a matching deadline, once, with a working unsubscribe link", async () => {
    const now = new Date("2026-10-26T06:00:00Z");
    const [l] = await lead();
    await lead({ email: "no@b.it", reminders: false });
    await lead({ email: "other@b.it", tags: ["solar"] });
    expect(await leadReminders(db, now, research("2026-12-31"))).toEqual({ sent: 0 }); // too far
    expect(await leadReminders(db, now, research("2026-11-20"))).toEqual({ sent: 1 });
    expect(await leadReminders(db, now, research("2026-11-20"))).toEqual({ sent: 0 });
    const [e] = await db.select().from(events).where(eq(events.type, "lead.reminder_due"));
    await notifyEvent(db, e);
    const [n] = await db.select().from(notifications);
    expect(n).toMatchObject({ kind: "marketing", email: "a@b.it", unsubscribeUrl: leadUnsubscribeUrl(l.id) });
    expect(n.subject).toBe("Tra 25 giorni: Registro F-gas");
    const t = new URL(n.unsubscribeUrl!).searchParams.get("t")!;
    await expect(unsubscribeLeadLink(db, l.id, "bad")).rejects.toMatchObject({ code: "invalid_link" });
    expect((await unsubscribeLeadLink(db, l.id, t))?.unsubscribedAt).not.toBeNull();
  });

  it("deletes unconfirmed leads after 30 days and keeps confirmed ones", async () => {
    const old = new Date(Date.now() - 31 * DAY);
    await lead({ email: "old@b.it", confirmedAt: null, createdAt: old });
    await lead({ email: "new@b.it", confirmedAt: null });
    await lead({ email: "kept@b.it", createdAt: old });
    expect(await retention(db)).toMatchObject({ leads: 1 });
    expect((await db.select().from(leads)).map((l) => l.email).sort()).toEqual(["kept@b.it", "new@b.it"]);
  });
});

describe("daily brief", () => {
  it("is stored once per Rome day, refreshed on a re-run, and is short", async () => {
    const now = new Date("2026-10-26T07:00:00Z");
    const r = await dailyReport(db, now);
    expect(r.day).toBe("2026-10-26");
    expect(r.verdict).toMatch(/nothing needs you|decision|stuck/);
    await dailyReport(db, now);
    expect((await db.select().from(reports)).length).toBe(1);
    expect(r.text.split(/\s+/).length).toBeLessThan(250);
  });
});
