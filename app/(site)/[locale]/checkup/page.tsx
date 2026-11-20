import type { Metadata } from "next";
import { copyFor } from "@/config/site-copy";
import { BRAND } from "@/mock/data";
import { checkupDefsFor } from "@/ui/site/checkup-defs";
import { chatEnabled } from "@/agents/checkup-chat";
import { Conversation } from "@/ui/site/Conversation";
import { visitorIndustry } from "@/ui/site/country";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ industry?: string; from?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: copyFor(locale).checkup.title };
}

// Door 1 of the check-up: a full-page conversation. The chat on the home page is door 2 (same engine).
export default async function CheckupPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { industry, from } = await searchParams;
  const site = copyFor(locale);
  const c = site.checkup;
  const defs = checkupDefsFor(locale);
  const known = industry ?? (await visitorIndustry())?.slug;
  const minutes = Math.max(...Object.values(defs).map((d) => d.minutes), 2);
  return (
    <main className="wrap-site section" style={{ maxWidth: 860 }}>
      <h1>🩺 {c.title}</h1>
      <p className="lead">{c.sub.replace("{n}", String(minutes))}</p>
      <div className="card chatbox" style={{ padding: 22 }}>
        <div className="row" style={{ marginBottom: 8 }}><span className="badge ai">✦ AI</span><span className="muted small">{site.chat.disclosure}</span></div>
        <Conversation defs={defs} industry={known} locale={locale} entrance="page" source={from?.slice(0, 40)} c={site} brand={BRAND} llm={chatEnabled()} />
      </div>
    </main>
  );
}
