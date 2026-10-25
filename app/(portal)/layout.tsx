import { headers } from "next/headers";
import { portalDir } from "@/config/portal-copy";
import { portalLangSoft } from "@/lib/portal-auth";
import "../ui.css";

export const metadata = { title: "Dashboard", robots: { index: false, follow: false } };

// Customer dashboard: its own root so the page language follows the customer (CLAUDE.md: portals are multilingual).
export default async function PortalRoot({ children }: { children: React.ReactNode }) {
  const lang = await portalLangSoft((await headers()).get("accept-language"));
  return (
    <html lang={lang} dir={portalDir(lang)}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
