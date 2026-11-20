import { notFound } from "next/navigation";
import { INDEPENDENCE_QUESTIONS } from "@/config/jurisdictions";
import { moneyCopy } from "@/config/money-copy";
import { getDb } from "@/db";
import { requirePartner } from "@/lib/partner-auth";
import { getContract } from "@/server/contracts";
import { ContractText } from "@/ui/shared/ContractView";
import { SignFlow } from "@/ui/shared/SignFlow";
import { PageHead } from "@/ui/Shell";

// Framework agreement (NDA, data processing, white-label, non-circumvention): signed once before the first offer.
export default async function PartnerContract({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, partner, lang, viewingAs } = await requirePartner();
  const c = await getContract(getDb(), id).catch(() => null);
  if (!c || c.partnerId !== partner.id) notFound();
  const t = moneyCopy(lang);
  return (
    <main className="stack" style={{ maxWidth: 860 }}>
      <PageHead title={c.title} sub={!c.reviewed ? t.draft : undefined} />
      {c.status === "signed" ? (
        <div className="callout" role="status">✅ {t.signed.replace("{date}", (c.signedAt ?? new Date()).toLocaleDateString(lang))} {t.signedPartner}</div>
      ) : c.status === "sent" && viewingAs ? (
        <div className="callout small">{t.viewingAs}</div>
      ) : c.status === "sent" ? (
        <SignFlow id={c.id} t={t} email={user.email} onerous={c.onerous} signedText={Boolean(c.evidence?.signedAt)} questions={INDEPENDENCE_QUESTIONS.map((q) => ({ id: q.id, text: q.text[lang] ?? q.text.en }))} />
      ) : null}
      <details className="card" open={c.status === "sent"}>
        <summary><b>{t.fullText}</b></summary>
        <ContractText body={c.body} lang={c.language} />
      </details>
    </main>
  );
}
