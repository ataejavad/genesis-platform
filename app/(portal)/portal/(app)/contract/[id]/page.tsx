import { notFound } from "next/navigation";
import { moneyCopy } from "@/config/money-copy";
import { fmtEur } from "@/config/portal-copy";
import { getDb } from "@/db";
import { requireCustomer } from "@/lib/portal-auth";
import { getContract } from "@/server/contracts";
import { ContractText } from "@/ui/shared/ContractView";
import { SignFlow } from "@/ui/shared/SignFlow";
import { PageHead } from "@/ui/Shell";

// The customer reads and signs the contract here (code by email; onerous clauses with a second code).
export default async function PortalContract({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, org, lang, viewingAs } = await requireCustomer();
  const c = await getContract(getDb(), id).catch(() => null);
  if (!c || c.orgId !== org.id) notFound();
  const t = moneyCopy(lang);
  return (
    <main className="stack" style={{ maxWidth: 860 }}>
      <PageHead title={c.title} sub={!c.reviewed ? t.draft : undefined} />
      <div className="card row small" style={{ gap: 18 }}>
        <span>{t.billing.amount}: <b className="num">{fmtEur(c.amountEur, lang)}</b></span>
        {c.monthlyEur > 0 && <span>+ <b className="num">{fmtEur(c.monthlyEur, lang)}</b> / {lang === "it" ? "mese" : lang === "de" ? "Monat" : lang === "fa" ? "ماه" : "month"}</span>}
        {c.depositEur > 0 && <span>{t.billing.kinds.deposit}: <b className="num">{fmtEur(c.depositEur, lang)}</b></span>}
      </div>
      {c.status === "signed" ? (
        <div className="callout" role="status">✅ {t.signed.replace("{date}", (c.signedAt ?? new Date()).toLocaleDateString(lang))} {c.depositEur > 0 && <a href="/portal/billing">{t.signedNext}</a>}</div>
      ) : c.status === "sent" && viewingAs ? (
        <div className="callout small">{t.viewingAs}</div>
      ) : c.status === "sent" ? (
        <SignFlow id={c.id} t={t} email={user.email} onerous={c.onerous} signedText={Boolean(c.evidence?.signedAt)} />
      ) : null}
      <details className="card" open={c.status === "sent"}>
        <summary><b>{t.fullText}</b></summary>
        <ContractText body={c.body} lang={c.language} />
      </details>
    </main>
  );
}
