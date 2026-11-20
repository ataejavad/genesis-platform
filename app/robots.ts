import type { MetadataRoute } from "next";
import { siteIndexable } from "@/lib/platform";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "";
  if (!siteIndexable()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/cockpit", "/login", "/map", "/portal", "/partner", "/welcome", "/api/"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
