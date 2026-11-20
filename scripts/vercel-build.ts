import { spawnSync } from "node:child_process";

// Vercel runs `npm run vercel-build` instead of `npm run build`: database tables first, the admin login, then the app.
// Every step is safe to run on every deploy.
const run = (cmd: string) => {
  console.log(`\n▶ ${cmd}`);
  const r = spawnSync(cmd, { stdio: "inherit", shell: true, env: process.env });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. In Vercel: Storage › Create Database › Neon (region Frankfurt) › Connect to this project, then redeploy.");
  process.exit(1);
}
if (!process.env.BETTER_AUTH_SECRET) {
  console.error("BETTER_AUTH_SECRET is missing. In Vercel: Settings › Environment Variables, add a long random text, then redeploy.");
  process.exit(1);
}
run("npm run db:migrate");
if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) run("npm run seed");
else console.log("ADMIN_EMAIL / ADMIN_PASSWORD not set: no cockpit login created yet");
// fictional demo customer, partner, projects and pages, so every door can be tried (SEED_DEMO=1; test phase only)
if (process.env.SEED_DEMO === "1") for (const s of ["demo", "demo:portal", "demo:partner", "demo:delivery"]) run(`npm run ${s}`);
run("npx next build");
