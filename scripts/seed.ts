import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { createDb } from "../src/db";
import { account, memberships, organizations, user } from "../src/db/schema";

// Creates the internal organisation and an admin user. Safe to run again.
// ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME=... npm run seed
const { DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = "Admin" } = process.env;
if (!DATABASE_URL || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error("DATABASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD are required");
}
if (ADMIN_PASSWORD.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters");

const db = createDb(DATABASE_URL, 1);

await db.insert(organizations).values({ name: "Internal", slug: "internal", kind: "internal" }).onConflictDoNothing();
const [org] = await db.select().from(organizations).where(eq(organizations.slug, "internal"));

let [admin] = await db.select().from(user).where(eq(user.email, ADMIN_EMAIL.toLowerCase()));
if (!admin) {
  [admin] = await db
    .insert(user)
    .values({ id: randomUUID(), name: ADMIN_NAME, email: ADMIN_EMAIL.toLowerCase(), emailVerified: true, role: "admin" })
    .returning();
  await db.insert(account).values({
    id: randomUUID(),
    accountId: admin.id,
    providerId: "credential",
    userId: admin.id,
    password: await hashPassword(ADMIN_PASSWORD),
  });
  console.log(`admin created: ${admin.email}`);
} else {
  await db.update(user).set({ role: "admin" }).where(eq(user.id, admin.id));
  console.log(`admin exists: ${admin.email}`);
}
await db.insert(memberships).values({ orgId: org.id, userId: admin.id, role: "owner" }).onConflictDoNothing();
await db.$client.end();
