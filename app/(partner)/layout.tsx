import { cookies, headers } from "next/headers";
import { portalDir } from "@/config/portal-copy";
import { guestLang, LANG_COOKIE } from "@/lib/portal-auth";
import "../ui.css";

export const metadata = { title: "Partner portal", robots: { index: false, follow: false } };

// Partner portal: its own root so the page language follows the partner (CLAUDE.md: portals are multilingual).
export default async function PartnerRoot({ children }: { children: React.ReactNode }) {
  const lang = (await cookies()).get(LANG_COOKIE)?.value ?? (await guestLang((await headers()).get("accept-language")));
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
