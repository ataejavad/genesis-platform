import Link from "next/link";
import { notFound } from "next/navigation";
import { tx } from "@/config/tx";
import { companies, industryOfKey, pick } from "@/mock/site";
import { ActionButton } from "@/ui/site/SiteClient";

// Public company page (directory, persona tier 0): public facts only until the company claims it (doc 15 §6ح).
export default async function CompanyPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const co = companies.find((x) => x.slug === slug);
  if (!co) notFound();
  const t = (fa: string, en: string) => tx(locale, fa, en);
  const { industry: hub, facts } = industryOfKey(co.hub);
  const hubHref = `/${locale}/hub/${hub.slug}/${facts.country.toLowerCase()}`;
  return (
    <main className="wrap-site section" style={{ maxWidth: 900 }}>
      <div className="crumbs"><Link href={`${hubHref}#directory`}>{pick(hub.name, locale)} {facts.flag}</Link></div>
      <div className="row"><span className="avatar" style={{ width: 56, height: 56, fontSize: 24 }}>{co.name[0]}</span><div><h1 style={{ margin: 0 }}>{co.name}</h1><div className="muted">{co.city} · {t("تأسیس", "Founded")} {co.founded} · {co.size} {t("نفر", "staff")}</div></div><span className="spacer" />{co.claimed ? <span className="badge ok">✓ {t("تأییدشده توسط خود شرکت", "Verified by the company")}</span> : <span className="badge gray">{t("ادعا نشده", "Unclaimed")}</span>}</div>
      <div className="grid g2" style={{ marginTop: 20 }}>
        <div className="card"><h3>{t("خدمات", "Services")}</h3><p>{pick(co.services, locale)}</p><div className="muted small">{t("منبع: ثبت شرکت‌ها و وب‌سایت عمومی شرکت", "Source: company register and the company's public website")}</div></div>
        <div className="card"><h3>{t("صنعت", "Industry")}</h3><p>{hub.icon} {pick(hub.name, locale)}</p><div className="muted small ltr">NACE {hub.nace}</div></div>
      </div>
      {!co.claimed && (
        <div className="card row" style={{ marginTop: 16 }}>
          <div style={{ flex: 1 }}><b>{t("این شرکت شماست؟", "Is this your company?")}</b><div className="muted small">{t("صفحه را رایگان ادعا کنید تا اطلاعات را کامل کنید، پست بگذارید و پیشنهاد مناقصه بگیرید.", "Claim the page for free to complete it, post in the hub and get tender matches.")}</div></div>
          <ActionButton className="btn primary" label={t("ادعای صفحه", "Claim this page")} done={t("ایمیل تأیید دامنه فرستاده شد", "Domain verification email sent")} />
        </div>
      )}
      <p className="muted small" style={{ marginTop: 16 }}>{t("درخواست اصلاح یا حذف این صفحه:", "Request a correction or removal:")} <a href="#">privacy@…</a> (GDPR)</p>
    </main>
  );
}
