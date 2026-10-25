import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { copyFor } from "@/config/site-copy";
import { getCheckup, lockedView } from "@/server/checkup";
import { CheckupReport } from "@/ui/site/CheckupReport";

type Props = { params: Promise<{ locale: string; id: string }> };

// Private report link (the random id is the key); never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function CheckupResult({ params }: Props) {
  const { locale, id } = await params;
  const row = await getCheckup(getDb(), id);
  if (!row) notFound();
  const c = copyFor(locale).checkup;
  return (
    <main className="wrap-site section" style={{ maxWidth: 860 }}>
      <h1>🩺 {c.title}</h1>
      <p className="muted small">{row.createdAt.toISOString().slice(0, 10)}</p>
      <CheckupReport report={row.unlockedAt ? row.report : lockedView(row.report)} c={c} locale={locale} />
      {!row.unlockedAt && <p style={{ marginTop: 16 }}><Link className="btn primary" href={`/${locale}/checkup?industry=${row.industry}`}>{c.unlockTitle}</Link></p>}
    </main>
  );
}
