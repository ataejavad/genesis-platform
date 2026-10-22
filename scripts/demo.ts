import { createDb } from "../src/db";
import { createDraft, decideApproval } from "../src/server/content";

// Fills a local database with sample pages so the site and cockpit can be tried out.
// Publishes most pages and leaves one draft waiting in the cockpit. Safe to run again.
const db = createDb(process.env.DATABASE_URL!, 1);
const agent = { type: "system", id: "demo" } as const;
const reviewer = { type: "system", id: "demo-reviewer" } as const;

type Page = { locale: string; slug: string; type?: string; title: string; summary: string; body: string; publish?: boolean };

const pages: Page[] = [
  {
    locale: "en-gb",
    slug: "solutions",
    type: "solution",
    title: "Five steps to an AI-ready company",
    summary: "From a free check-up to your own company agent. You only pay for outcomes.",
    body: `## The growth ladder

| Step | What you get | Price |
|---|---|---|
| 1. Free AI check-up | Where AI saves you time and money, scored | Free |
| 2. Ready-made solution | A proven agent for one problem, set up for you | Monthly |
| 3. Custom transformation | Integration with your systems | Project + monthly |
| 4. Technology partner | We watch, test and adopt new tools for you | Monthly |
| 5. Company persona | Your company's own AI that works with other businesses' agents | Monthly |

We sell outcomes, not software. Every service has a monthly report in your dashboard.`,
  },
  {
    locale: "en-gb",
    slug: "glass/ai-quotes",
    type: "industry-hub",
    title: "AI for glass and glazing companies",
    summary: "Quotes in minutes instead of days, fewer missed calls, more jobs won.",
    body: `## Common problems we solve

- Quotes take days because measurements and prices are checked by hand
- Calls are missed while the team is on site
- Follow-ups are forgotten

## What we set up

1. **Quote agent** that reads the enquiry and drafts a price from your list
2. **Phone and chat agent** that answers 24/7 and books site visits
3. **Monthly report** of time saved and jobs won

[Start the free AI check-up](#)`,
  },
  {
    locale: "fa-ir",
    slug: "solutions",
    type: "solution",
    title: "پنج پله تا شرکتی آماده برای هوش مصنوعی",
    summary: "از چک‌آپ رایگان تا ایجنت اختصاصی شرکت. فقط برای نتیجه پول می‌دهید.",
    body: `## نردبان رشد

| پله | چه می‌گیرید | قیمت |
|---|---|---|
| ۱. چک‌آپ رایگان AI | کجا AI وقت و پول شما را نجات می‌دهد، با امتیاز | رایگان |
| ۲. راه‌حل آماده | یک ایجنت آزموده برای یک مشکل، راه‌اندازی‌شده | ماهانه |
| ۳. تحول سفارشی | اتصال به سیستم‌های خودتان | پروژه + ماهانه |
| ۴. شریک دائمی تکنولوژی | ابزارهای تازه را برایتان رصد، آزمایش و اجرا می‌کنیم | ماهانه |
| ۵. پرسونای شرکت | AI اختصاصی شرکت شما که با ایجنت‌های شرکت‌های دیگر کار می‌کند | ماهانه |

ما نتیجه می‌فروشیم، نه نرم‌افزار. هر خدمت گزارش ماهانه در داشبورد شما دارد.`,
  },
  {
    locale: "de-de",
    slug: "glas/ki-angebote",
    type: "industry-hub",
    title: "KI für Glasereien",
    summary: "Angebote in Minuten statt Tagen.",
    body: "## Was wir einrichten\n\n1. Angebots-Agent\n2. Telefon- und Chat-Agent rund um die Uhr\n3. Monatlicher Bericht",
  },
  {
    locale: "en-gb",
    slug: "media/why-ai-pilots-fail",
    type: "article",
    title: "Why most AI pilots in small companies fail (and how to avoid it)",
    summary: "Draft written by the content agent, waiting for approval.",
    body: "## Three reasons\n\n1. No clear number to improve\n2. Nobody owns the tool after setup\n3. The tool doesn't talk to the systems the team already uses",
    publish: false,
  },
];

for (const { publish = true, ...page } of pages) {
  const { approvalId } = await createDraft(db, agent, page);
  if (publish) await decideApproval(db, reviewer, approvalId, "approved");
  console.log(`${publish ? "published" : "waiting "}  /${page.locale}/${page.slug}`);
}
await db.$client.end();
