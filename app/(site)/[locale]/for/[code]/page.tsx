import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { chatEnabled } from "@/agents/checkup-chat";
import { copyFor } from "@/config/site-copy";
import { getDb } from "@/db";
import { BRAND } from "@/mock/data";
import { getLivePage, recordView } from "@/server/company-pages";
import type { Report } from "@/server/checkup";
import { CheckupReport } from "@/ui/site/CheckupReport";
import { checkupDefsFor } from "@/ui/site/checkup-defs";
import { Conversation } from "@/ui/site/Conversation";

type Props = { params: Promise<{ locale: string; code: string }> };

export const dynamic = "force-dynamic";
// Private link for one company: never indexed.
export const metadata: Metadata = { robots: { index: false, follow: false } };

const BOT = /bot|crawl|spider|preview|slurp|facebookexternalhit|linkedin|whatsapp/i;

/** The page made for one company before the first contact: facts with sources, estimate, starter persona. */
export default async function CompanyPage({ params }: Props) {
  const { locale, code } = await params;
  const page = await getLivePage(getDb(), code);
  if (!page) notFound();
  // Link previews (LinkedIn, WhatsApp) are not visits.
  if (!BOT.test((await headers()).get("user-agent") ?? "")) await recordView(getDb(), code);
  const site = copyFor(locale);
  const t = site.forPage;
  const { doc } = page;
  const report = doc.estimate.report as unknown as Report;
  return (
    <main className="wrap-site section" style={{ maxWidth: 920 }}>
      <p className="muted small">{t.kicker}</p>
      <h1 style={{ marginTop: 0 }}>{doc.company}{doc.city ? <span className="muted"> · {doc.city}</span> : null}</h1>
      <p className="lead">{t.sub}</p>

      <section className="grid g2" style={{ gap: 16, alignItems: "start" }}>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>✦ {t.persona}</h3>
          <p>{doc.persona.summary}</p>
          {doc.persona.offers.length > 0 && <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>{doc.persona.offers.map((o) => <span key={o} className="badge">{o}</span>)}</div>}
          {doc.persona.pains.length > 0 && (
            <>
              <h4>{t.pains}</h4>
              <ul>{doc.persona.pains.map((p) => <li key={p.text}><b>{p.text}</b><div className="muted small">{p.why}</div></li>)}</ul>
            </>
          )}
          <h4>{t.questions}</h4>
          <ul>{doc.persona.questions.map((q) => <li key={q}>{q}</li>)}</ul>
          <p className="muted small">{t.personaNote}</p>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t.facts}</h3>
          <ul className="small">{doc.facts.map((f) => <li key={f.text}>{f.text} · <a href={f.source.url} rel="nofollow noopener" target="_blank">{f.source.name}</a></li>)}</ul>
          <p className="muted small">{t.prepared.replace("{d}", doc.preparedAt)}</p>
        </div>
      </section>

      <h2>{t.estimate}</h2>
      <p className="muted small">{t.estimateNote}</p>
      <CheckupReport report={report} c={site.checkup} locale={locale} />

      <h2>{t.chat}</h2>
      <div className="card chatbox" style={{ padding: 22 }}>
        <div className="row" style={{ marginBottom: 8 }}><span className="badge ai">✦ AI</span><span className="muted small">{site.chat.disclosure}</span></div>
        <Conversation defs={checkupDefsFor(locale)} industry={report.industry} locale={locale} entrance="page" source={`for-${code}`} c={site} brand={BRAND} llm={chatEnabled()} greeting={t.hello.replace("{company}", doc.company)} />
      </div>
      <p className="muted small" style={{ marginTop: 24 }}><a href={`/api/v1/outreach/optout?t=${code}`}>{t.remove}</a></p>
    </main>
  );
}
