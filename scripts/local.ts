import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { and, count, eq, isNull } from "drizzle-orm";
import { createDb } from "../src/db";
import { apiKeys, contentItems } from "../src/db/schema";
import { createApiKey } from "../src/server/api-keys";

// `npm run local`: the whole app on this computer with no database to install.
// Data is kept in ./.localdb between runs. For trying things out only; production uses real Postgres.
const port = 5444;
const pg = await PGlite.create("./.localdb");
const server = new PGLiteSocketServer({ db: pg, port, maxConnections: 10 });
await server.start();

const env = {
  ...process.env,
  DATABASE_URL: `postgres://postgres@127.0.0.1:${port}/postgres`,
  DATABASE_POOL_MAX: "1",
  ADMIN_EMAIL: process.env.ADMIN_EMAIL ?? "admin@local.test",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "local-demo-password",
  ADMIN_NAME: process.env.ADMIN_NAME ?? "Local admin",
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? "local-only-secret-do-not-use-in-production",
};
// Async on purpose: the database server lives in this process, so it must keep running while we wait.
const run = (cmd: string) =>
  new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, { stdio: "inherit", env, shell: true });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`))));
  });

await run("npm run db:migrate");
const db = createDb(env.DATABASE_URL, 1);
const [{ n }] = await db.select({ n: count() }).from(contentItems);
// The hub-builder agent writes through the API like in production, with a fresh key for this run.
const agentName = "hub-builder (local)";
await db.update(apiKeys).set({ revokedAt: new Date() }).where(and(eq(apiKeys.name, agentName), isNull(apiKeys.revokedAt)));
const { key: hubKey } = await createApiKey(db, { name: agentName, scopes: ["content:draft"] });
// Outbound: the company agent adds companies (crm:write); the outbox sends due emails / AI calls (outreach:run).
const fresh = async (name: string, scopes: Parameters<typeof createApiKey>[1]["scopes"]) => {
  await db.update(apiKeys).set({ revokedAt: new Date() }).where(and(eq(apiKeys.name, name), isNull(apiKeys.revokedAt)));
  return (await createApiKey(db, { name, scopes })).key;
};
const outboundKey = await fresh("company-finder (local)", ["crm:write"]);
const outboxKey = await fresh("outbox (local)", ["outreach:run"]);
await db.$client.end();
if (n === 0) {
  await run("npm run seed");
  await run("npm run demo");
}

console.log(`
  Site:     http://localhost:3000
  Cockpit:  http://localhost:3000/cockpit   (${env.ADMIN_EMAIL} / ${env.ADMIN_PASSWORD})
  Stop:     Ctrl+C
`);

const app = spawn("npm", ["run", "dev"], { stdio: "inherit", env, shell: true });

// Once the site answers, send the newest hub research as drafts (unchanged pages are skipped).
void (async () => {
  for (let i = 0; i < 90; i++) {
    const up = await fetch("http://localhost:3000/api/health").then((r) => r.ok, () => false);
    if (up) {
      const agent = spawn("npm", ["run", "agents:hubs"], { stdio: "inherit", env: { ...env, APP_URL: "http://localhost:3000", HUB_AGENT_KEY: hubKey }, shell: true });
      agent.on("exit", (code) => code && console.log("hub-builder finished with warnings; see above"));
      // Outbox every 10 minutes: due emails (once a provider key exists) and AI calls (once switched on).
      const outbox = () => fetch("http://localhost:3000/api/v1/outreach/run", { method: "POST", headers: { authorization: `Bearer ${outboxKey}` } }).catch(() => null);
      setInterval(outbox, 10 * 60_000);
      // The outbound agent finds this run's key on its own (local mode only).
      writeFileSync("./.localdb/outbound-agent.key", outboundKey, { mode: 0o600 });
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
})();
const stop = async () => {
  app.kill();
  await server.stop();
  await pg.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
app.on("exit", stop);
