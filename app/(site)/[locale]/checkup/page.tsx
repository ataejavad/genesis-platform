import type { Metadata } from "next";
import { Checkup } from "./checkup";

export const metadata: Metadata = { title: "Free check-up" };

export default async function CheckupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <main className="wrap-site section" style={{ maxWidth: 860 }}>
      <Checkup locale={locale} />
    </main>
  );
}
