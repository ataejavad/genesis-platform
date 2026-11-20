import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { LOCALE_COOKIE, pickLocale } from "@/config/locales";

// "/" sends visitors to their language: saved choice, then browser, then IP country as a hint (doc 12).
// Only "/" redirects; every other URL keeps its language so shared links and search results stay stable.
export default async function Root() {
  const h = await headers();
  const locale = pickLocale({
    saved: (await cookies()).get(LOCALE_COOKIE)?.value,
    acceptLanguage: h.get("accept-language"),
    country: h.get("cf-ipcountry") ?? h.get("x-vercel-ip-country"),
  });
  redirect(`/${locale}`);
}
