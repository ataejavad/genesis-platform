import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/cockpit", "/login", "/map", "/portal", "/partner", "/welcome", "/api/"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
