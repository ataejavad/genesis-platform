import { tx } from "@/config/tx";

export default async function Legal({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = (fa: string, en: string) => tx(locale, fa, en);
  return (
    <main className="wrap-site section" style={{ maxWidth: 820 }}>
      <h1>{t("اطلاعات حقوقی و حریم خصوصی", "Legal notice & privacy")}</h1>
      <div className="callout warn" style={{ marginBottom: 16 }}>{t("متن نهایی پس از ثبت شرکت و بررسی وکیل هر کشور (بسته کشور) جایگزین می‌شود.", "Final text replaces this after company registration and per-country legal review (country pack).")}</div>
      <div className="card stack">
        <h3>Impressum / Note legali</h3><p className="muted">{t("نام شرکت، نشانی، شماره ثبت، شماره مالیاتی، نماینده قانونی، تماس.", "Company name, address, register number, VAT ID, legal representative, contact.")}</p>
        <h3>{t("حریم خصوصی (GDPR)", "Privacy (GDPR)")}</h3><p className="muted">{t("چه داده‌ای، برای چه، تا کی، پردازشگرهای فرعی (عمومی)، حقوق شما، تماس مسئول حفاظت داده.", "What data, why, how long, sub-processors (generic), your rights, data protection contact.")}</p>
        <h3>{t("هوش مصنوعی (AI Act)", "Artificial intelligence (AI Act)")}</h3><p className="muted">{t("کجا با AI صحبت می‌کنید و انسان کجا تصمیم می‌گیرد.", "Where you talk to AI and where a human decides.")}</p>
        <h3>{t("دسترس‌پذیری", "Accessibility")}</h3><p className="muted">{t("هدف ما WCAG 2.2 سطح AA است (قانون دسترس‌پذیری اروپا).", "We target WCAG 2.2 level AA (European Accessibility Act).")}</p>
        <h3>{t("کوکی‌ها", "Cookies")}</h3><p className="muted">{t("فقط با رضایت شما؛ تنظیمات در پایین هر صفحه.", "Only with your consent; settings at the bottom of every page.")}</p>
      </div>
    </main>
  );
}
