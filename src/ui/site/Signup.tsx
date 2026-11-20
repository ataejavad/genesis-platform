"use client";

import Link from "next/link";
import { useState } from "react";
import { companies, industries, industryOfKey, pick, sectors, type L } from "@/mock/site";
import { rememberIndustry } from "@/ui/site/Remember";

// Sign-up without an industry picker (doc 15 §6ه.2): the onboarding agent looks the company up in public
// registers and its website, proposes the NACE code, and the customer only confirms. Prototype: mock lookup.
type Found = { nace: string; name: L; industry?: string; city?: string; country: string };

// Free-text description → NACE. The real agent uses an LLM over the full NACE tree; this mock uses keywords.
const words: [string, RegExp][] = [
  ["F43.34", /glas|window|fenster|vetr|finestr|شیشه|پنجره/i],
  ["Q86.23", /dent|zahn|دندان/i],
  ["F43.91", /roof|dach|tett|بام|سقف/i],
  ["F43.22", /plumb|heiz|sanit|idraul|لوله|گرمایش/i],
  ["F43.21", /electr|elektr|برق/i],
  ["I56.10", /restaur|pizz|café|رستوران/i],
  ["M69.20", /account|steuer|commercial|حسابدار|مالیات/i],
  ["C10.71", /bak|bäck|panific|نان|شیرینی/i],
  ["G45.20", /car |auto|kfz|officina|خودرو|تعمیرگاه/i],
];
const subByNace = (nace: string) => sectors.flatMap((s) => s.subs).find((x) => x.nace === nace)!;

export function Signup({ locale, country }: { locale: string; country: string }) {
  const t = (fa: string, en: string) => (locale.startsWith("fa") ? fa : en);
  const [step, setStep] = useState<"name" | "looking" | "confirm" | "describe" | "done">("name");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [notFound, setNotFound] = useState(false);
  const countryName = (cc: string) => new Intl.DisplayNames([locale.slice(0, 2), "en"], { type: "region" }).of(cc);

  const lookup = () => {
    if (!name.trim()) return;
    setStep("looking");
    setTimeout(() => {
      const co = companies.find((c) => c.name.toLowerCase().includes(name.trim().toLowerCase()));
      if (co) {
        const { industry, facts } = industryOfKey(co.hub);
        const sub = subByNace(industry.nace.split(" / ").at(-1)!);
        setFound({ nace: sub.nace, name: sub.name, industry: industry.slug, city: co.city, country: facts.country });
        setStep("confirm");
      } else {
        setNotFound(true);
        setStep("describe");
      }
    }, 1200);
  };
  const classify = () => {
    const nace = words.find(([, re]) => re.test(text))?.[0];
    const sub = nace ? subByNace(nace) : undefined;
    setFound(sub ? { nace: sub.nace, name: sub.name, industry: sub.industry, country } : { nace: "?", name: { fa: "در حال بررسی توسط تیم ما", en: "Being classified by our team" }, country });
    setStep("confirm");
  };
  const confirm = () => {
    const ind = industries.find((i) => i.slug === found?.industry);
    if (ind?.live) rememberIndustry(ind.slug);
    setStep("done");
  };
  const hub = industries.find((i) => i.slug === found?.industry && i.live && i.countries.some((f) => f.country === found.country));

  return (
    <div className="card stack" style={{ gap: 14, maxWidth: 640 }}>
      {step === "name" && (
        <form className="stack" style={{ gap: 10 }} onSubmit={(e) => { e.preventDefault(); lookup(); }}>
          <label htmlFor="su-name"><b>{t("نام شرکت شما", "Your company name")}</b></label>
          <input id="su-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Glas Becker GmbH" autoComplete="organization" />
          <div className="muted small">{t("لازم نیست صنعت را از فهرست پیدا کنید؛ ما آن را از ثبت شرکت‌ها و وب‌سایت شما پیدا می‌کنیم.", "No need to find your industry in a list: we look it up in company registers and on your website.")}</div>
          <button className="btn primary">{t("پیدا کردن شرکت من", "Find my company")}</button>
        </form>
      )}
      {step === "looking" && (
        <div className="stack" aria-live="polite">
          <b>✦ {t("در حال جستجو…", "Looking you up…")}</b>
          <div className="muted small">{t("ثبت شرکت‌ها · وب‌سایت شرکت · نقشه گوگل", "Company register · company website · Google Business profile")}</div>
        </div>
      )}
      {step === "describe" && (
        <form className="stack" style={{ gap: 10 }} onSubmit={(e) => { e.preventDefault(); classify(); }}>
          {notFound && <div className="callout small">{t("این شرکت را در منابع عمومی پیدا نکردیم.", "We could not find this company in public sources.")}</div>}
          <label htmlFor="su-text"><b>{t("با زبان خودتان بگویید شرکتتان چه کار می‌کند", "Describe in your own words what your company does")}</b></label>
          <textarea id="su-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("مثلاً: پنجره دوجداره می‌سازیم و نصب می‌کنیم", "e.g. we make and fit double-glazed windows")} />
          <button className="btn primary">{t("ادامه", "Continue")}</button>
        </form>
      )}
      {step === "confirm" && found && (
        <div className="stack" style={{ gap: 12 }} aria-live="polite">
          <div className="callout ai">
            ✦ {found.nace === "?" ? t("صنعت شما را تیم ما ظرف یک روز دسته‌بندی می‌کند. می‌توانید همین حالا ادامه دهید.", "Our team will classify your industry within a day. You can continue now.") : (
              <>{t("شما", "You are")} <b>{pick(found.name, locale)}</b> <span className="badge gray ltr">NACE {found.nace}</span> {t("در", "in")} <b>{found.city ? `${found.city}, ` : ""}{countryName(found.country)}</b> {t("هستید، درست است؟", "— right?")}</>
            )}
          </div>
          <div className="row">
            <button className="btn primary" onClick={confirm}>{found.nace === "?" ? t("ادامه", "Continue") : t("بله، درست است", "Yes, that's right")}</button>
            {found.nace !== "?" && <button className="btn" onClick={() => { setNotFound(false); setStep("describe"); }}>{t("نه، چیز دیگری است", "No, something else")}</button>}
          </div>
        </div>
      )}
      {step === "done" && found && (
        <div className="stack" style={{ gap: 12 }} aria-live="polite">
          {hub ? (
            <div className="callout ai">✓ {t("داشبورد شما برای این صنعت آماده شد:", "Your dashboard is set up for")} <b>{hub.icon} {pick(hub.name, locale)} · {countryName(found.country)}</b>. {t("محتوا، راه‌حل‌ها و مشاور شما تخصصی همین صنعت است.", "Content, solutions and your advisor are specialised for it.")}</div>
          ) : (
            <div className="callout">✓ {t("هنوز هاب تخصصی برای این صنعت نداریم. همین حالا می‌توانید از همه چیز با محتوای عمومی استفاده کنید. صنعت شما به‌عنوان تقاضا ثبت شد و وقتی هابش باز شود اول به شما خبر می‌دهیم.", "We don't have a specialist hub for this industry yet. You can use everything now with general content. Your industry is logged as demand, and you'll be the first to know when its hub opens.")}</div>
          )}
          <div className="row">
            <Link className="btn primary" href="/portal">{t("رفتن به داشبورد من", "Go to my dashboard")}</Link>
            {hub && <Link className="btn" href={`/${locale}/hub/${hub.slug}/${found.country.toLowerCase()}`}>{t("هاب صنعت من", "My industry hub")}</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
