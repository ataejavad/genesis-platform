import { parseArgs } from "node:util";
import { createDb } from "../src/db";
import { createApiKey, SCOPES, type Scope } from "../src/server/api-keys";

// npm run apikey:create -- --name content-agent --scopes content:draft,content:read [--market <uuid>]
const { values } = parseArgs({
  options: { name: { type: "string" }, scopes: { type: "string" }, market: { type: "string" } },
});
if (!values.name || !values.scopes) throw new Error("--name and --scopes are required");
const scopes = values.scopes.split(",") as Scope[];
const unknown = scopes.filter((s) => !SCOPES.includes(s));
if (unknown.length) throw new Error(`unknown scopes: ${unknown.join(", ")} (known: ${SCOPES.join(", ")})`);

const db = createDb(process.env.DATABASE_URL!, 1);
const { id, key } = await createApiKey(db, { name: values.name, scopes, marketId: values.market });
await db.$client.end();
console.log(`key id: ${id}\nkey (shown once, store it in n8n credentials): ${key}`);
