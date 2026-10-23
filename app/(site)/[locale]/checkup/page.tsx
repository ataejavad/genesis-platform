import type { Metadata } from "next";
import { copyFor } from "@/config/site-copy";
import { BRAND } from "@/mock/data";
import { checkupDefsFor } from "@/ui/site/checkup-defs";
import { CheckupFlow } from "@/ui/site/CheckupFlow";
import { visitorIndustry } from "@/ui/site/country";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ industry?: string; from?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: copyFor(locale).checkup.title };
}

// Entrance 1 of the check-up: the plain form. The concierge chat on the home page is entrance 2 (same engine).
export default async function CheckupPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { industry, from } = await searchParams;
  const c = copyFor(locale).checkup;
  const defs = checkupDefsFor(locale);
  const known = industry ?? (await visitorIndustry())?.slug;
  const minutes = Math.max(...Object.values(defs).map((d) => d.minutes), 2);
  return (
    <main className="wrap-site section" style={{ maxWidth: 860 }}>
      <h1>🩺 {c.title}</h1>
      <p className="lead">{c.sub.replace("{n}", String(minutes))}</p>
      <div className="card" style={{ padding: 22 }}>
        <CheckupFlow defs={defs} industry={known} locale={locale} entrance="form" source={from?.slice(0, 40)} c={c} brand={BRAND} />
      </div>
    </main>
  );
}
