import { spawnSync } from "node:child_process";

// Vercel runs `npm run vercel-build` instead of `npm run build`: database tables first, the admin login, then the app.
// Every step is safe to run on every deploy.
const run = (cmd: string) => {
  console.log(`\n▶ ${cmd}`);
  const r = spawnSync(cmd, { stdio: "inherit", shell: true, env: process.env });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// Missing settings only warn, so the app itself still builds (and a failing build always means a real code error).
const warn = (m: string) => console.warn(`\n⚠ ${m}\n`);
if (!process.env.BETTER_AUTH_SECRET) warn("BETTER_AUTH_SECRET is missing: logins will not work. Vercel › Settings › Environment Variables, add a long random text, then redeploy.");
if (!process.env.DATABASE_URL) {
  warn("DATABASE_URL is missing: no database yet, pages that need data will fail. Vercel › Storage › Create Database › Neon (Frankfurt) › Connect, then redeploy.");
} else {
  run("npm run db:migrate");
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) run("npm run seed");
  else console.log("ADMIN_EMAIL / ADMIN_PASSWORD not set: no cockpit login created yet");
  // fictional demo customer, partner, projects and pages, so every door can be tried (SEED_DEMO=1; test phase only)
  if (process.env.SEED_DEMO === "1") for (const s of ["demo", "demo:portal", "demo:partner", "demo:delivery"]) run(`npm run ${s}`);
}
run("npx next build");
