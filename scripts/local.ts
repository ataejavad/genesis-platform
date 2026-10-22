import { spawn } from "node:child_process";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { count } from "drizzle-orm";
import { createDb } from "../src/db";
import { contentItems } from "../src/db/schema";

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
const stop = async () => {
  app.kill();
  await server.stop();
  await pg.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
app.on("exit", stop);
