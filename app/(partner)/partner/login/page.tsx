import { headers } from "next/headers";
import { partnerCopy } from "@/config/partner-copy";
import { guestLang } from "@/lib/portal-auth";
import { BRAND } from "@/mock/data";
import { LoginForm } from "@/ui/shared/LoginForm";

export default async function PartnerLogin() {
  const lang = await guestLang((await headers()).get("accept-language"));
  const t = partnerCopy(lang).login;
  return (
    <main style={{ maxWidth: 400, margin: "12vh auto", padding: 16 }}>
      <div className="row" style={{ marginBottom: 18, gap: 10 }}><span className="logo">L</span><h1 style={{ margin: 0 }}>{t.title}</h1></div>
      <LoginForm t={t} next="/partner" />
      <p className="muted small" style={{ marginTop: 12 }}>{BRAND}</p>
    </main>
  );
}
