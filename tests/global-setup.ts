import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "../src/db";

// Tests need a throwaway Postgres: TEST_DATABASE_URL=postgres://.../genesis_test npm test
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set");
  const db = createDb(url, 1);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await db.$client.end();
}
