import { getDb } from "@/db";
import { LOCALES } from "@/config/locales";
import { listPublished } from "@/server/content";

export const dynamic = "force-dynamic";

// Machine-readable index for AI agents (https://llmstxt.org), generated from published content.
export async function GET() {
  const base = process.env.APP_URL ?? "";
  const pages = await listPublished(getDb());
  const lines = [
    `# ${process.env.SITE_NAME ?? "Genesis"}`,
    "",
    `> ${process.env.SITE_DESCRIPTION ?? "Technology adoption partner for companies: we find, integrate and run the right AI and software for each industry."}`,
    "",
  ];
  for (const locale of Object.keys(LOCALES)) {
    const own = pages.filter((p) => p.locale === locale);
    if (own.length === 0) continue;
    lines.push(`## ${LOCALES[locale as keyof typeof LOCALES].label}`, "");
    for (const p of own) lines.push(`- [${p.title}](${base}/${p.locale}/${p.slug})${p.summary ? `: ${p.summary}` : ""}`);
    lines.push("");
  }
  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, s-maxage=600" },
  });
}
