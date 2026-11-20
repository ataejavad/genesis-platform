import { eq } from "drizzle-orm";
import { createDb } from "../src/db";
import { organizations } from "../src/db/schema";
import { addGoal, addOutcome, addSubscription, askCustomerApproval, createCustomer, setGoalCurrent } from "../src/server/portal";

// A fictional demo customer so the dashboard can be tried: customer@local.test / local-demo-password.
// Runs once (skips when the demo company exists). Results over three months, goals and one approval waiting.
const db = createDb(process.env.DATABASE_URL!, 1);
const actor = { type: "system", id: "demo" } as const;
const NAME = "Rossi Impianti Srl (demo)";

const [exists] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.name, NAME));
if (exists) {
  console.log("demo customer exists");
} else {
  const now = new Date();
  const ago = (months: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months, 1));
  const { org, phone, follow } = await db.transaction(async (tx) => {
    const c = await createCustomer(tx, actor, { name: NAME, country: "IT", industry: "installers", locale: "it", baselineEur: 4200, email: "customer@local.test", contactName: "Marco Rossi" }, "local-demo-password");
    const phone = await addSubscription(tx, actor, c.org.id, "phone-agent", "Standard", 390, ago(2));
    const follow = await addSubscription(tx, actor, c.org.id, "followup-agent", "Standard", 190, ago(1));
    return { org: c.org, phone, follow };
  });
  const rec = (m: number, sub: string, metric: string, value: number, eur: number) => addOutcome(db, actor, { orgId: org.id, subscriptionId: sub, metric, value, eur, at: ago(m) });
  for (const [m, calls, won] of [[2, 61, 0], [1, 74, 3], [0, 39, 2]] as const) {
    await rec(m, phone.id, "calls_answered", calls, calls * 18);
    await rec(m, phone.id, "hours_saved", Math.round(calls / 4), Math.round(calls / 4) * 32);
    if (won) await rec(m, follow.id, "jobs_won", won, won * 640);
  }
  const calls = await addGoal(db, actor, { orgId: org.id, metric: "calls_answered", title: { it: "Nessuna chiamata persa", en: "No missed calls", de: "Kein verpasster Anruf", fa: "هیچ تماسی بی‌جواب نماند" }, baseline: 62, target: 98, unit: "%" });
  await setGoalCurrent(db, actor, org.id, calls.id, 93);
  const won = await addGoal(db, actor, { orgId: org.id, metric: "jobs_won", title: { it: "Preventivi vinti al mese", en: "Quotes won per month", de: "Gewonnene Angebote pro Monat", fa: "پیش‌فاکتورهای برنده در ماه" }, baseline: 4, target: 8, unit: "" });
  await setGoalCurrent(db, actor, org.id, won.id, 6);
  await askCustomerApproval(db, actor, { orgId: org.id, title: "Nuovo messaggio di benvenuto al telefono", detail: "«Buongiorno, Rossi Impianti. Siamo in cantiere: lasci nome e problema, la richiamiamo entro un'ora.»" });
  console.log(`demo customer created: customer@local.test / local-demo-password (${org.id})`);
}
await db.$client.end();
