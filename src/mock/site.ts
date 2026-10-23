// Sample public content for the prototype: industry hubs (NACE sub-industry, country as a filter), marketplace products,
// directory companies, hub news, member posts and tenders. Real rows will come from Postgres and agents.
export type L = { fa: string; en: string };
export const pick = (l: L, locale: string) => (locale.startsWith("fa") ? l.fa : l.en);

// One hub per industry; the country is a filter inside it. Facts that differ by country (market numbers,
// pains, rules, news, directory, posts, tenders) live per country; solutions are mostly shared.
export type CountryFacts = {
  country: string; flag: string; overview: L;
  stats: { companies: number; employees: string; marketSize: string; aiAdoption: string };
  pains: L[]; law: L;
  // Every block shows where it came from and when; facts go live only after 2 trusted sources agree.
  sources: { stats: string; law: string; updated: string; lawUpdated: string };
};

export type Industry = { slug: string; icon: string; nace: string; live: boolean; name: L; countries: CountryFacts[] };

export const industries: Industry[] = [
  {
    slug: "glass", icon: "🪟", nace: "C23.12 / F43.34", live: true,
    name: { fa: "شیشه و پنجره", en: "Glass & windows" },
    countries: [
      {
        country: "DE", flag: "🇩🇪",
        overview: {
          fa: "حدود ۹٬۴۰۰ شرکت کوچک و متوسط شیشه‌بری و پنجره‌سازی در آلمان. فشار اصلی: کمبود نیرو، قیمت‌دهی کند، و رقابت آنلاین.",
          en: "About 9,400 small and mid-sized glaziers and window makers in Germany. Main pressures: labour shortage, slow quoting and online competition.",
        },
        stats: { companies: 9400, employees: "≈ 78k", marketSize: "€11.2bn", aiAdoption: "9%" },
        pains: [
          { fa: "قیمت‌دهی ۲ تا ۳ روز طول می‌کشد", en: "Quotes take 2–3 days" },
          { fa: "۳۰٪ تماس‌ها بی‌پاسخ می‌مانند", en: "30% of calls go unanswered" },
          { fa: "پیگیری پیشنهادهای قیمت دستی است", en: "Quote follow-up is manual" },
        ],
        law: { fa: "GEG (بهره‌وری انرژی ساختمان)، فاکتور الکترونیک B2B از ۲۰۲۵، قانون AI اتحادیه اروپا", en: "GEG energy rules, B2B e-invoicing from 2025, EU AI Act" },
        sources: { stats: "Eurostat SBS · Destatis", law: "EUR-Lex · BMWK", updated: "2026-10-21", lawUpdated: "2026-10-02" },
      },
      {
        country: "IT", flag: "🇮🇹",
        overview: { fa: "بازار پراکنده با شرکت‌های خانوادگی؛ مشوق‌های بازسازی (Ecobonus) تقاضا را بالا نگه داشته است.", en: "Fragmented, family-owned market; renovation incentives (Ecobonus) keep demand high." },
        stats: { companies: 12100, employees: "≈ 64k", marketSize: "€8.9bn", aiAdoption: "6%" },
        pains: [{ fa: "اسناد مشوق‌های دولتی وقت‌گیر است", en: "Incentive paperwork eats time" }, { fa: "قیمت‌دهی کند", en: "Slow quoting" }],
        law: { fa: "فاکتور الکترونیک SDI (اجباری)، Ecobonus، GDPR", en: "SDI e-invoicing (mandatory), Ecobonus, GDPR" },
        sources: { stats: "Eurostat SBS · ISTAT", law: "Agenzia delle Entrate · ENEA", updated: "2026-10-20", lawUpdated: "2026-08-30" },
      },
    ],
  },
  {
    slug: "installers", icon: "🔧", nace: "F43.22", live: false,
    name: { fa: "نصاب‌های تأسیسات", en: "Heating & plumbing installers" },
    countries: [
      {
        country: "GB", flag: "🇬🇧",
        overview: { fa: "نامزد بعدی ایجنت انتخاب بازار. تا محتوای اولیه آماده نشود منتشر نمی‌شود.", en: "Next candidate from market selection. Not published until seed content is ready." },
        stats: { companies: 31000, employees: "≈ 150k", marketSize: "£14bn", aiAdoption: "7%" },
        pains: [{ fa: "زمان‌بندی بازدیدها", en: "Visit scheduling" }],
        law: { fa: "UK GDPR، MTD برای VAT", en: "UK GDPR, MTD for VAT" },
        sources: { stats: "ONS", law: "GOV.UK · ICO", updated: "2026-10-15", lawUpdated: "2026-10-15" },
      },
    ],
  },
];

// Explore: the full standard tree (NACE section › sub-industry). Sub-industries with a hub link to it;
// the rest show "coming soon" or can be requested, which feeds market selection.
export type Sector = { code: string; name: L; subs: { nace: string; name: L; industry?: string }[] };
export const sectors: Sector[] = [
  { code: "C", name: { fa: "تولید", en: "Manufacturing" }, subs: [
    { nace: "C23.12", name: { fa: "شکل‌دهی و فرآوری شیشه تخت", en: "Shaping and processing of flat glass" }, industry: "glass" },
    { nace: "C25.12", name: { fa: "ساخت در و پنجره فلزی", en: "Metal doors and windows" }, industry: "glass" },
    { nace: "C10.71", name: { fa: "نان و شیرینی", en: "Bread and fresh pastry" } },
  ] },
  { code: "F", name: { fa: "ساخت‌وساز", en: "Construction" }, subs: [
    { nace: "F43.34", name: { fa: "شیشه‌کاری و نصب پنجره", en: "Glazing and window fitting" }, industry: "glass" },
    { nace: "F43.22", name: { fa: "لوله‌کشی، گرمایش و تهویه", en: "Plumbing, heat and air-conditioning" }, industry: "installers" },
    { nace: "F43.21", name: { fa: "تأسیسات برق", en: "Electrical installation" } },
    { nace: "F43.91", name: { fa: "بام‌سازی", en: "Roofing" } },
  ] },
  { code: "G", name: { fa: "تجارت و تعمیر خودرو", en: "Trade and vehicle repair" }, subs: [
    { nace: "G45.20", name: { fa: "تعمیر و نگهداری خودرو", en: "Vehicle maintenance and repair" } },
  ] },
  { code: "I", name: { fa: "هتل و رستوران", en: "Accommodation and food" }, subs: [
    { nace: "I56.10", name: { fa: "رستوران", en: "Restaurants" } },
  ] },
  { code: "M", name: { fa: "خدمات تخصصی", en: "Professional services" }, subs: [
    { nace: "M69.20", name: { fa: "حسابداری و مشاوره مالیاتی", en: "Accounting and tax advice" } },
  ] },
  { code: "Q", name: { fa: "سلامت", en: "Health" }, subs: [
    { nace: "Q86.23", name: { fa: "دندان‌پزشکی", en: "Dental practice" } },
  ] },
];

// Menus and lists show only live industries, so visitors never face a long list.
export const liveIndustries = industries.filter((i) => i.live);

// Rows tagged with one industry in one country (news, tenders, directory, posts) use this key, e.g. "glass-de".
export const hubKey = (industry: string, country: string) => `${industry}-${country.toLowerCase()}`;

// Country of an industry: the asked one if the industry covers it, else the first one.
export function factsFor(industry: Industry, country?: string | null): CountryFacts {
  return industry.countries.find((c) => c.country === country?.toUpperCase()) ?? industry.countries[0];
}

export function industryOfKey(key: string) {
  const [slug, cc] = key.split("-");
  const industry = industries.find((i) => i.slug === slug)!;
  return { industry, facts: factsFor(industry, cc) };
}

export type Product = {
  slug: string; icon: string; industries: string[]; countries?: string[]; process: string; kind: L; name: L; outcome: L; how: L[];
  setup: L; plans: { name: string; price: number; per: L; features: L[] }[]; rating: number; reviews: number;
  delivery: "native" | "embedded" | "sso"; protocol: string; faq: { q: L; a: L }[];
};

export const products: Product[] = [
  {
    slug: "quote-agent", icon: "🧮", industries: ["glass"], process: "APQC 3.5 · Sales › Quote",
    kind: { fa: "ایجنت", en: "Agent" },
    name: { fa: "ایجنت قیمت‌دهی شیشه", en: "Glass quote agent" },
    outcome: { fa: "قیمت در ۱۲ دقیقه به جای ۲ روز؛ ۹ کار بیشتر در ماه", en: "Quotes in 12 minutes instead of 2 days; 9 more jobs a month" },
    how: [
      { fa: "لیست قیمت و قوانین تخفیف شما را یاد می‌گیرد", en: "Learns your price list and discount rules" },
      { fa: "درخواست قیمت از ایمیل، فرم یا تلفن را می‌خواند", en: "Reads quote requests from email, forms or phone" },
      { fa: "پیش‌فاکتور با برند شما می‌سازد؛ موارد خاص را به شما می‌دهد", en: "Drafts a branded quote; hands edge cases to you" },
    ],
    setup: { fa: "۵ روز کاری", en: "5 working days" },
    plans: [
      { name: "Starter", price: 290, per: { fa: "ماهانه", en: "per month" }, features: [{ fa: "تا ۲۰۰ قیمت در ماه", en: "Up to 200 quotes/month" }, { fa: "ایمیل و فرم", en: "Email & forms" }] },
      { name: "Pro", price: 490, per: { fa: "ماهانه", en: "per month" }, features: [{ fa: "نامحدود", en: "Unlimited" }, { fa: "تلفن + اتصال CRM", en: "Phone + CRM link" }, { fa: "گزارش ماهانه ROI", en: "Monthly ROI report" }] },
    ],
    rating: 4.8, reviews: 14, delivery: "native", protocol: "PR-01 v2",
    faq: [
      { q: { fa: "اگر قیمت اشتباه بدهد؟", en: "What if it quotes wrong?" }, a: { fa: "هر قیمت بالای سقف شما برای تأیید به شما می‌آید. دقت ±۳٪ در پروتکل تضمین شده است.", en: "Anything above your limit comes to you for approval. ±3% accuracy is guaranteed by protocol." } },
      { q: { fa: "داده‌ها کجا می‌ماند؟", en: "Where is the data stored?" }, a: { fa: "فقط در اتحادیه اروپا، طبق قرارداد حفاظت داده.", en: "EU only, under our data processing agreement." } },
    ],
  },
  {
    slug: "phone-agent", icon: "📞", industries: ["glass", "installers"], process: "APQC 5.2 · Service › Inquiries",
    kind: { fa: "ایجنت", en: "Agent" },
    name: { fa: "پاسخ‌گوی ۲۴ ساعته تلفن و چت", en: "24/7 phone & chat answering" },
    outcome: { fa: "۹۷٪ تماس‌ها پاسخ داده می‌شوند؛ نوبت و قیمت ثبت می‌شود", en: "97% of calls answered; bookings and quote requests captured" },
    how: [{ fa: "به زبان مشتری صحبت می‌کند و خود را AI معرفی می‌کند", en: "Speaks the caller's language and discloses it is AI" }, { fa: "نوبت را در تقویم شما می‌گذارد", en: "Books into your calendar" }],
    setup: { fa: "۳ روز کاری", en: "3 working days" },
    plans: [{ name: "Standard", price: 390, per: { fa: "ماهانه", en: "per month" }, features: [{ fa: "تا ۵۰۰ تماس", en: "Up to 500 calls" }, { fa: "چت سایت", en: "Website chat" }] }],
    rating: 4.7, reviews: 22, delivery: "embedded", protocol: "PR-02 v3",
    faq: [{ q: { fa: "شماره‌ام عوض می‌شود؟", en: "Do I change my number?" }, a: { fa: "نه، فقط هدایت تماس فعال می‌شود.", en: "No, we only set up call forwarding." } }],
  },
  {
    slug: "incentive-docs", icon: "📑", industries: ["glass"], countries: ["IT"], process: "APQC 8.6 · Finance › Grants",
    kind: { fa: "بسته خدمت", en: "Service package" },
    name: { fa: "پرونده‌ساز مشوق‌های Ecobonus", en: "Ecobonus paperwork assistant" },
    outcome: { fa: "پرونده مشوق در ۱ روز به جای ۱ هفته", en: "Incentive files in 1 day instead of 1 week" },
    how: [{ fa: "اسناد پروژه را جمع و بررسی می‌کند", en: "Collects and checks project documents" }, { fa: "فرم‌ها را پر می‌کند و به شما برای امضا می‌دهد", en: "Fills the forms and sends them to you to sign" }],
    setup: { fa: "۷ روز کاری", en: "7 working days" },
    plans: [{ name: "Per file", price: 49, per: { fa: "هر پرونده", en: "per file" }, features: [{ fa: "بررسی کامل اسناد", en: "Full document check" }] }],
    rating: 4.6, reviews: 5, delivery: "native", protocol: "PR-06 v1",
    faq: [],
  },
  {
    slug: "followup-agent", icon: "🔁", industries: ["glass", "installers"], countries: ["DE", "GB"], process: "APQC 3.5 · Sales › Follow-up",
    kind: { fa: "ایجنت", en: "Agent" },
    name: { fa: "پیگیری خودکار پیشنهاد قیمت", en: "Automatic quote follow-up" },
    outcome: { fa: "۲۲٪ پیشنهادهای بی‌جواب دوباره زنده می‌شوند", en: "22% of silent quotes revived" },
    how: [{ fa: "۳ و ۷ روز بعد پیام شخصی می‌فرستد", en: "Sends a personal nudge after 3 and 7 days" }],
    setup: { fa: "۲ روز کاری", en: "2 working days" },
    plans: [{ name: "Standard", price: 190, per: { fa: "ماهانه", en: "per month" }, features: [{ fa: "ایمیل و واتس‌اپ", en: "Email & WhatsApp" }] }],
    rating: 4.5, reviews: 9, delivery: "sso", protocol: "PR-07 v1",
    faq: [],
  },
];

export const companies = [
  { slug: "glas-becker", name: "Glas Becker GmbH", hub: "glass-de", city: "Köln", size: "12", founded: 1987, claimed: true, services: { fa: "شیشه ساختمانی، پنجره، دوجداره", en: "Building glass, windows, double glazing" }, signals: 4 },
  { slug: "fensterbau-mueller", name: "Fensterbau Müller", hub: "glass-de", city: "München", size: "25", founded: 1994, claimed: false, services: { fa: "پنجره PVC و آلومینیوم", en: "PVC and aluminium windows" }, signals: 2 },
  { slug: "glastec-nord", name: "GlasTec Nord", hub: "glass-de", city: "Hamburg", size: "40", founded: 2003, claimed: false, services: { fa: "نما و شیشه سازه‌ای", en: "Facades and structural glass" }, signals: 3 },
  { slug: "vetreria-bianchi", name: "Vetreria Bianchi", hub: "glass-it", city: "Milano", size: "9", founded: 1972, claimed: false, services: { fa: "شیشه‌بری و آینه", en: "Glazing and mirrors" }, signals: 2 },
];

export const news = [
  { hub: "glass-de", date: "2026-10-21", src: "Glaswelt", t: { fa: "قیمت شیشه تخت ۴٪ پایین آمد", en: "Float glass prices fall 4%" }, ai: { fa: "فرصت: پیشنهادهای قیمت قدیمی را به‌روز کنید.", en: "Opportunity: refresh open quotes." } },
  { hub: "glass-de", date: "2026-10-19", src: "BMWK", t: { fa: "دور تازه یارانه نوسازی پنجره از ژانویه", en: "New window-renovation subsidy round from January" }, ai: { fa: "تقاضا در Q1 بالا می‌رود؛ ظرفیت قیمت‌دهی را آماده کنید.", en: "Expect a Q1 demand spike; prepare quoting capacity." } },
  { hub: "glass-de", date: "2026-10-17", src: "Handelsblatt", t: { fa: "۳ شیشه‌بری آلمانی با AI زمان قیمت‌دهی را نصف کردند", en: "3 German glaziers halve quoting time with AI" }, ai: { fa: "نمونه‌کار مرتبط: ایجنت قیمت‌دهی.", en: "Related: glass quote agent." } },
  { hub: "glass-it", date: "2026-10-20", src: "Il Sole 24 Ore", t: { fa: "تمدید Ecobonus برای ۲۰۲۷ تأیید شد", en: "Ecobonus extended to 2027" }, ai: { fa: "پرونده‌ساز مشوق را ببینید.", en: "See the Ecobonus paperwork assistant." } },
];

export const posts = [
  { hub: "glass-de", by: "Glas Becker GmbH", date: "2026-10-18", t: { fa: "تجربه ما با ایجنت تلفن: ۹۷٪ تماس‌ها پاسخ داده شد", en: "Our experience with an AI phone agent: 97% of calls answered" }, status: "published" },
  { hub: "glass-de", by: "GlasTec Nord", date: "2026-10-21", t: { fa: "دنبال همکار برای پروژه نمای هامبورگ هستیم", en: "Looking for a partner for a Hamburg facade project" }, status: "pending" },
];

export const tenders = [
  { hub: "glass-de", cpv: "44221000", title: { fa: "پنجره‌های مدرسه، شهرداری دوسلدورف", en: "School windows, City of Düsseldorf" }, value: "€420k", deadline: "2026-11-14" },
  { hub: "glass-de", cpv: "45441000", title: { fa: "شیشه‌کاری ساختمان اداری، بن", en: "Glazing for office building, Bonn" }, value: "€180k", deadline: "2026-11-02" },
  { hub: "glass-it", cpv: "44221000", title: { fa: "تعویض پنجره بیمارستان، تورین", en: "Hospital window replacement, Turin" }, value: "€650k", deadline: "2026-12-01" },
];

export const freeTools = [
  { slug: "roi", icon: "📈", name: { fa: "ماشین‌حساب صرفه‌جویی", en: "Savings calculator" }, desc: { fa: "در ۳۰ ثانیه ببینید ماهانه چقدر وقت و پول برمی‌گردد.", en: "See in 30 seconds how much time and money you get back each month." } },
  { slug: "checkup", icon: "🩺", name: { fa: "چک‌آپ رایگان", en: "Free check-up" }, desc: { fa: "گفتگو با ایجنت تشخیص؛ گزارش کامل.", en: "Talk to the diagnostic agent; get a full report." } },
  { slug: "tenders", icon: "📣", name: { fa: "هشدار مناقصه صنعت شما", en: "Tender alerts for your industry" }, desc: { fa: "مناقصه‌های تازه هر هفته در ایمیل.", en: "New tenders weekly by email." } },
  { slug: "gdpr", icon: "🛡️", name: { fa: "چک‌لیست AI Act و GDPR", en: "AI Act & GDPR checklist" }, desc: { fa: "آیا استفاده شما از AI قانونی است؟", en: "Is your AI use compliant?" } },
];

// Solutions shown in one industry for one country: shared ones plus those built for that country.
export const productsFor = (industry: string, country: string) =>
  products.filter((p) => p.industries.includes(industry) && (!p.countries || p.countries.includes(country)));
