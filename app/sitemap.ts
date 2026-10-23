import type { MetadataRoute } from "next";
import { getDb } from "@/db";
import { listPublished } from "@/server/content";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "";
  const pages = await listPublished(getDb());
  return pages.map((p) => ({ url: `${base}/${p.locale}/${p.slug}`, lastModified: p.updatedAt }));
}
