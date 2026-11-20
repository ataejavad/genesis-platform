import type { MetadataRoute } from "next";
import { LOCALES } from "@/config/locales";
import { getDb } from "@/db";
import { industries, products } from "@/mock/site";
import { listPublished } from "@/server/content";

export const dynamic = "force-dynamic";

// Every public page in every language: fixed pages, live industry hubs (one URL per country, as their
// canonical says), marketplace listings, then the published content pages.
const FIXED = ["", "/checkup", "/explore", "/market", "/tools", "/about", "/partners", "/signup", "/legal"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "";
  const paths = [
    ...FIXED,
    ...industries.filter((i) => i.live).flatMap((i) => i.countries.map((c) => `/hub/${i.slug}/${c.country.toLowerCase()}`)),
    ...products.map((p) => `/market/${p.slug}`),
  ];
  const fixed = Object.keys(LOCALES).flatMap((locale) => paths.map((p) => ({ url: `${base}/${locale}${p}` })));
  const pages = await listPublished(getDb());
  return [...fixed, ...pages.map((p) => ({ url: `${base}/${p.locale}/${p.slug}`, lastModified: p.updatedAt }))];
}
