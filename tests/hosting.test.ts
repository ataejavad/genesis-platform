import { describe, expect, it } from "vitest";
import { createDraft } from "@/server/content";
import { applyPlatformDefaults, extraOrigins, siteIndexable } from "@/lib/platform";
import { storageFromEnv } from "@/providers/storage";
import { chosen } from "@/providers/registry";
import { releaseLease, runTick, takeLease } from "@/server/tick";
import { requestTick, setTickScheduler } from "@/server/tick-soon";
import { agent, draft, useTestDb } from "./helpers";

// Vercel test phase (2026-11-20): no disk, no always-on worker.
const db = useTestDb();
process.env.DATABASE_URL ??= process.env.TEST_DATABASE_URL;

describe("platform defaults", () => {
  it("fills Vercel defaults without overriding what is set", () => {
    const env: Record<string, string | undefined> = { VERCEL: "1", VERCEL_PROJECT_PRODUCTION_URL: "genesis.vercel.app", VERCEL_URL: "genesis-abc.vercel.app", STORAGE_PROVIDER: "", DATABASE_POOL_MAX: "7" };
    applyPlatformDefaults(env);
    expect(env).toMatchObject({ APP_URL: "https://genesis.vercel.app", BETTER_AUTH_URL: "https://genesis.vercel.app", STORAGE_PROVIDER: "database", DATABASE_PREPARE: "false", DATABASE_POOL_MAX: "7", TICK_AFTER_REQUESTS: "1" });
    expect(chosen("storage", env)).toBe("database");
    expect(extraOrigins(env)).toEqual(["https://genesis-abc.vercel.app"]);
  });

  it("does nothing off Vercel", () => {
    const env: Record<string, string | undefined> = {};
    applyPlatformDefaults(env);
    expect(env).toEqual({});
    expect(chosen("storage", env)).toBe("local");
  });
});

describe("database file storage", () => {
  it("stores, reads and removes bytes", async () => {
    const store = storageFromEnv({ STORAGE_PROVIDER: "database" });
    expect(store.provider).toBe("database");
    const key = "00000000-0000-4000-8000-000000000001";
    await store.put(key, new Uint8Array([1, 2, 3, 250]));
    expect(Array.from(await store.get(key))).toEqual([1, 2, 3, 250]);
    await store.remove(key);
    await expect(store.get(key)).rejects.toThrow(/not found/);
  });
});

describe("background tick without a worker", () => {
  it("only one holder of the lease at a time; an expired lease can be taken over", async () => {
    const now = new Date("2026-11-20T10:00:00Z");
    const a = await takeLease(db, "x", 60_000, now);
    expect(a).toBeTruthy();
    expect(await takeLease(db, "x", 60_000, now)).toBeNull();
    expect(await takeLease(db, "x", 60_000, new Date(now.getTime() + 61_000))).toBeTruthy();
    await releaseLease(db, "x", a!); // not the holder any more: no effect
    expect(await takeLease(db, "x", 60_000, new Date(now.getTime() + 62_000))).toBeNull();
  });

  it("drains the outbox; a second pass running at the same time skips", async () => {
    await createDraft(db, agent, draft());
    const deps = { adminChat: null, mailer: null, voice: null };
    const [one, two] = await Promise.all([runTick(db, deps, { jobs: false, budgetMs: 10_000 }), runTick(db, deps, { jobs: false, budgetMs: 10_000 })]);
    const ran = [one, two].filter((r) => !r.skipped);
    expect(ran.length).toBeGreaterThanOrEqual(1);
    expect(ran.reduce((n, r) => n + (r.skipped ? 0 : r.events), 0)).toBeGreaterThan(0);
    const again = await runTick(db, deps, { jobs: false, budgetMs: 10_000 });
    expect(again).toMatchObject({ skipped: false, events: 0 });
  });

  it("emit asks the host for one tick; without a host nothing happens", async () => {
    let calls = 0;
    setTickScheduler(() => calls++);
    requestTick();
    requestTick();
    expect(calls).toBe(1);
    await Promise.resolve();
    requestTick();
    expect(calls).toBe(2);
    setTickScheduler(null);
    requestTick();
    expect(calls).toBe(2);
  });
});

describe("search engines on test hosting", () => {
  it("keep out of the demo site on Vercel unless SITE_INDEXABLE=1; a laptop or own server stays indexable", () => {
    expect(siteIndexable({ VERCEL: "1" })).toBe(false);
    expect(siteIndexable({ VERCEL: "1", SITE_INDEXABLE: "1" })).toBe(true);
    expect(siteIndexable({})).toBe(true);
    expect(siteIndexable({ SITE_INDEXABLE: "0" })).toBe(false);
  });
});
