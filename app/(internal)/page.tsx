import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { negotiateLocale } from "@/config/locales";

// "/" sends visitors to their language; marketing links should point at industry pages directly (doc 12).
export default async function Root() {
  redirect(`/${negotiateLocale((await headers()).get("accept-language"))}`);
}
