import { createDb } from "../src/db";
import { createDraft } from "../src/server/content";

// Creates a test draft so the whole loop (worker → Telegram → approve → live page) can be checked.
const db = createDb(process.env.DATABASE_URL!, 1);
const slug = `test/smoke-${Date.now()}`;
const r = await createDraft(db, { type: "system", id: "smoke-test" }, {
  locale: "en-gb",
  slug,
  title: "Smoke test",
  summary: "If you can read this page, publishing works.",
  body: "This page was created by `npm run smoke`. Archive it once checked.",
});
await db.$client.end();
console.log(`draft created: approval ${r.approvalId}; after approving, open ${process.env.APP_URL ?? ""}/en-gb/${slug}`);
