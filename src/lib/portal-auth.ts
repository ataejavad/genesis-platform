import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PORTAL_LANGS } from "@/config/portal-copy";
import { getDb } from "@/db";
import { customerOrgFor, firstCustomerOrg } from "@/server/portal";
import { getCurrentUser } from "./auth";

export const LANG_COOKIE = "portal_lang";

const known = (l: string | null | undefined) => (l && (PORTAL_LANGS as readonly string[]).includes(l) ? l : null);

/** The signed-in customer and their company. Admins see the oldest customer (labelled as admin view). */
export async function requireCustomer() {
  const user = await getCurrentUser();
  if (!user) redirect("/portal/login");
  const db = getDb();
  const mine = await customerOrgFor(db, user.id);
  let org = mine?.org ?? null;
  const viewingAs = !mine && user.role === "admin";
  if (viewingAs) org = await firstCustomerOrg(db);
  if (!org) redirect(user.role === "admin" ? "/cockpit" : "/portal/login?error=no-company");
  const lang = known((await cookies()).get(LANG_COOKIE)?.value) ?? known(org.locale?.slice(0, 2)) ?? "en";
  return { user, org, lang, viewingAs, role: mine?.role ?? "owner" };
}

/** Language for pages without a session (login): cookie, then the browser's languages. */
export async function guestLang(acceptLanguage: string | null) {
  const c = known((await cookies()).get(LANG_COOKIE)?.value);
  if (c) return c;
  for (const part of (acceptLanguage ?? "").split(",")) {
    const l = known(part.trim().slice(0, 2).toLowerCase());
    if (l) return l;
  }
  return "en";
}

/** Language for the html element: the customer's when signed in, otherwise the guest rule. No redirects. */
export async function portalLangSoft(acceptLanguage: string | null) {
  const c = known((await cookies()).get(LANG_COOKIE)?.value);
  if (c) return c;
  const user = await getCurrentUser().catch(() => null);
  const mine = user ? await customerOrgFor(getDb(), user.id) : null;
  return known(mine?.org.locale?.slice(0, 2)) ?? (await guestLang(acceptLanguage));
}
