import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PORTAL_LANGS } from "@/config/portal-copy";
import { getDb } from "@/db";
import { partners } from "@/db/schema";
import { partnerForUser } from "@/server/partners";
import { asc, eq } from "drizzle-orm";
import { getCurrentUser } from "./auth";
import { LANG_COOKIE } from "./portal-auth";

const known = (l: string | null | undefined) => (l && (PORTAL_LANGS as readonly string[]).includes(l) ? l : null);

/** The signed-in partner. Admins see the oldest active partner (labelled as admin view). */
export async function requirePartner() {
  const user = await getCurrentUser();
  if (!user) redirect("/partner/login");
  const db = getDb();
  let partner = await partnerForUser(db, user.id);
  const viewingAs = !partner && user.role === "admin";
  if (viewingAs) [partner] = await db.select().from(partners).where(eq(partners.status, "active")).orderBy(asc(partners.createdAt)).limit(1);
  if (!partner) redirect(user.role === "admin" ? "/cockpit/partners" : "/partner/login?error=no-partner");
  const lang = known((await cookies()).get(LANG_COOKIE)?.value) ?? known(partner.locale) ?? "en";
  return { user, partner, lang, viewingAs };
}
