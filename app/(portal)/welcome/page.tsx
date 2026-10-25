import { headers } from "next/headers";
import { moneyCopy } from "@/config/money-copy";
import { guestLang } from "@/lib/portal-auth";
import { BRAND } from "@/mock/data";
import { WelcomeForm } from "./WelcomeForm";

export default async function Welcome({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const t = moneyCopy(await guestLang((await headers()).get("accept-language"))).welcome;
  return (
    <main style={{ maxWidth: 420, margin: "12vh auto", padding: 16 }}>
      <div className="row" style={{ marginBottom: 18, gap: 10 }}>
        <span className="logo">L</span>
        <h1 style={{ margin: 0 }}>{t.title}</h1>
      </div>
      <p className="muted">{t.sub}</p>
      {token ? <WelcomeForm t={t} token={token} /> : <p role="alert">{t.bad}</p>}
      <p className="muted small" style={{ marginTop: 12 }}>{BRAND}</p>
    </main>
  );
}
