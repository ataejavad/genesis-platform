import { createDb } from "../src/db";
import { seedDelivery } from "../src/server/projects";
import { ensureAdmin, MIN_PASSWORD } from "../src/server/team-login";

// Creates the internal organisation and the admin login. Safe to run again: runs on every deploy.
// ADMIN_EMAIL / ADMIN_PASSWORD always win, so changing them in the hosting settings + a redeploy resets the login.
// ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME=... npm run seed
const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = "Admin" } = process.env;
if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error("DATABASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD are required");
}

const db = createDb(DATABASE_URL, 1);
if (ADMIN_PASSWORD.trim().length < MIN_PASSWORD) {
  // a short password must not stop the deploy (the site and "Forgot password?" keep working); the login stays as it was
  console.warn(`\n⚠ ADMIN_PASSWORD is shorter than ${MIN_PASSWORD} characters: cockpit login NOT changed. Use a longer one and redeploy.\n`);
} else {
  const r = await ensureAdmin(db, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: ADMIN_NAME });
  console.log(
    r.created
      ? `admin created: ${r.email}`
      : r.passwordChanged
        ? `admin password updated from ADMIN_PASSWORD: ${r.email} (all devices signed out)`
        : `admin exists, password unchanged: ${r.email}`,
  );
}
// first protocols and catalogue packages (step 7); existing ones are kept
await seedDelivery(db);
await db.$client.end();
