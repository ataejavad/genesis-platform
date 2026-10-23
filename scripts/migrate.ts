import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "../src/db";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
const db = createDb(url, 1);
await migrate(db, { migrationsFolder: "./drizzle" });
await db.$client.end();
console.log("migrations applied");
