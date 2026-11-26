import { type AnyColumn, type SQL, sql } from "drizzle-orm";

/*
 * Demo and test data (seed scripts, QA runs on the live test site) stays in the database so the demo logins keep
 * working, but it must never wake Javad: it is left out of ops-watch alerts, the daily report, "Needs you" and
 * cockpit KPIs. A record is demo when its `demo` flag is set; the flag is set on insert from the name or email.
 */

/** Names and emails that mark demo/test data: "… (demo)", "QA Test …", "Test …", and the demo logins @local.test. */
export function isDemo(...values: (string | null | undefined)[]) {
  return values.some((v) => !!v && (/\(demo\)|^\s*(qa\s+)?test\b/i.test(v) || /@local\.test$/i.test(v.trim())));
}

/** True when the organization behind `col` is real (or there is none). */
export const realOrg = (col: AnyColumn | SQL): SQL => sql`(${col} is null or not exists (select 1 from organizations d where d.id = ${col} and d.demo))`;
/** True when the partner behind `col` is real (or there is none). */
export const realPartner = (col: AnyColumn | SQL): SQL => sql`(${col} is null or not exists (select 1 from partners d where d.id = ${col} and d.demo))`;
/** True when the order behind `col` is real (or there is none). */
export const realOrder = (col: AnyColumn | SQL): SQL => sql`(${col} is null or not exists (select 1 from orders d where d.id = ${col} and d.demo))`;
/** True when the project behind `col` belongs to a real customer and came from a real order (or there is none). */
export const realProject = (col: AnyColumn | SQL): SQL =>
  sql`(${col} is null or not exists (select 1 from projects p left join organizations o on o.id = p.org_id left join orders r on r.id = p.order_id where p.id = ${col} and (coalesce(o.demo, false) or coalesce(r.demo, false))))`;
/** True when the job behind `col` is real: not for a demo customer, project or partner. */
export const realJob = (col: AnyColumn | SQL): SQL =>
  sql`(${col} is null or not exists (select 1 from jobs j where j.id = ${col} and not (${realOrg(sql`j.customer_org_id`)} and ${realProject(sql`j.project_id`)} and ${realPartner(sql`j.partner_id`)})))`;
