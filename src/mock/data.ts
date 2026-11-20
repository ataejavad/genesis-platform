// Sample data for the clickable prototype. Each screen marks where real data will come from.
// Replace module by module as the backend is wired (see business-plan/15-web-app-design.md).

export const BRAND = process.env.SITE_NAME ?? "Legend Partner";

export const fmtEur = (n: number) => `€${n.toLocaleString("en-US")}`;

export type Status = "todo" | "doing" | "review" | "done";
export const statusLabel: Record<Status, string> = { todo: "انجام‌نشده", doing: "در حال انجام", review: "بازبینی", done: "تمام" };

export const ladder = [
  { n: 1, title: "چک‌آپ رایگان AI", desc: "می‌سنجیم کجا AI وقت و پول شما را نجات می‌دهد؛ با امتیاز آمادگی و نقشه راه.", price: "رایگان", free: true },
  { n: 2, title: "راه‌حل آماده", desc: "یک ایجنت آزموده برای یک مشکل مشخص، راه‌اندازی‌شده و تحت نظر ما.", price: "از €290 در ماه" },
  { n: 3, title: "تحول سفارشی", desc: "اتصال AI به سیستم‌های خود شما: CRM، حسابداری، تلفن، انبار.", price: "پروژه + ماهانه" },
  { n: 4, title: "شریک دائمی تکنولوژی", desc: "ابزارهای تازه را برایتان رصد، آزمایش و اجرا می‌کنیم.", price: "از €900 در ماه" },
  { n: 5, title: "پرسونای شرکت", desc: "AI اختصاصی شرکت شما که با ایجنت‌های شرکت‌های دیگر کار می‌کند.", price: "ماهانه" },
];

export const industries = [
  { slug: "glass", icon: "🪟", name: "شیشه و پنجره", pain: "قیمت‌دهی کند، تماس‌های از دست رفته", markets: ["آلمان", "ایتالیا"] },
  { slug: "installers", icon: "🔧", name: "نصاب‌ها و تأسیسات", pain: "زمان‌بندی بازدید، پیگیری مشتری", markets: ["بریتانیا", "آلمان"] },
  { slug: "dental", icon: "🦷", name: "کلینیک‌های دندان", pain: "نوبت‌دهی، یادآوری، پاسخ ۲۴ ساعته", markets: ["آلمان"] },
  { slug: "logistics", icon: "🚚", name: "حمل‌ونقل و لجستیک", pain: "ردیابی سفارش، اسناد، قیمت‌دهی", markets: ["ایتالیا"] },
  { slug: "real-estate", icon: "🏢", name: "املاک", pain: "پاسخ به سرنخ‌ها، بازدیدها", markets: ["امارات", "آلمان"] },
  { slug: "manufacturing", icon: "🏭", name: "تولیدی‌های کوچک", pain: "پیش‌بینی، کنترل کیفیت، سفارش", markets: ["ایتالیا", "آلمان"] },
];

export const customer = {
  id: "C-1042",
  name: "Glas Becker GmbH",
  industry: "شیشه و پنجره",
  country: "آلمان",
  contact: "Thomas Becker",
  plan: "راه‌حل آماده + شریک تکنولوژی",
  readiness: 64,
  readinessHistory: [38, 45, 52, 58, 64],
  monthlyFee: 1190,
  savedHours: 46,
  wonJobs: 9,
};

export const services = [
  { id: "S1", name: "ایجنت پاسخ‌گویی تلفن و چت ۲۴ ساعته", step: 2, status: "فعال", since: "۱۴۰۵/۰۶/۰۱", kpi: "۹۷٪ تماس‌ها پاسخ داده شد", fee: 390 },
  { id: "S2", name: "ایجنت قیمت‌دهی خودکار", step: 2, status: "فعال", since: "۱۴۰۵/۰۷/۰۵", kpi: "میانگین زمان قیمت: ۱۲ دقیقه (قبلاً ۲ روز)", fee: 290 },
  { id: "S3", name: "شریک دائمی تکنولوژی", step: 4, status: "فعال", since: "۱۴۰۵/۰۶/۰۱", kpi: "۳ ابزار تازه آزموده شد", fee: 510 },
];

export type Project = {
  id: string; title: string; kind: "customer" | "internal"; customer?: string; customerCode?: string;
  status: Status; progress: number; due: string; protocol: string; partner: string; partnerCode: string;
  sell?: number; cost?: number; steps: { t: string; state: "done" | "now" | "next" }[];
};

export const projects: Project[] = [
  {
    id: "P-301", title: "راه‌اندازی ایجنت قیمت‌دهی شیشه", kind: "customer", customer: "Glas Becker GmbH", customerCode: "C-1042",
    status: "review", progress: 85, due: "۱۴۰۵/۰۸/۱۰", protocol: "راه‌اندازی ایجنت قیمت‌دهی v2", partner: "NovaAI Studio (هلند)", partnerCode: "H-17",
    sell: 2400, cost: 1300,
    steps: [{ t: "شرح کار و پروتکل", state: "done" }, { t: "دریافت داده قیمت‌ها", state: "done" }, { t: "ساخت و آزمون", state: "done" }, { t: "بازبینی کیفیت (QA)", state: "now" }, { t: "تحویل به مشتری", state: "next" }],
  },
  {
    id: "P-302", title: "اتصال تماس‌ها به CRM مشتری", kind: "customer", customer: "Glas Becker GmbH", customerCode: "C-1042",
    status: "doing", progress: 40, due: "۱۴۰۵/۰۸/۲۰", protocol: "اتصال CRM v1", partner: "Marco Rossi (فریلنسر، ایتالیا)", partnerCode: "H-22",
    sell: 1800, cost: 950,
    steps: [{ t: "شرح کار و پروتکل", state: "done" }, { t: "دسترسی به CRM", state: "done" }, { t: "ساخت اتصال", state: "now" }, { t: "بازبینی کیفیت", state: "next" }, { t: "تحویل", state: "next" }],
  },
  {
    id: "P-118", title: "کمپین لینکدین صنعت شیشه آلمان", kind: "internal", status: "doing", progress: 55, due: "۱۴۰۵/۰۸/۱۵",
    protocol: "کمپین محتوای لینکدین v1", partner: "Sara K. (بازاریاب، فریلنسر)", partnerCode: "H-09",
    steps: [{ t: "پیام اصلی و مخاطب", state: "done" }, { t: "۱۲ پست", state: "now" }, { t: "اجرا و سنجش", state: "next" }],
  },
  {
    id: "P-119", title: "۲۰ صفحه صنعت × کشور (ایتالیا)", kind: "internal", status: "todo", progress: 0, due: "۱۴۰۵/۰۸/۳۰",
    protocol: "صفحه صنعت × کشور v3", partner: "ایجنت محتوا", partnerCode: "AG-content",
    steps: [{ t: "تحقیق بازار", state: "next" }, { t: "پیش‌نویس", state: "next" }, { t: "تأیید جواد", state: "next" }],
  },
];

export type Task = { id: string; title: string; project: string; assignee: string; agent?: boolean; due: string; status: Status; priority: "بالا" | "متوسط" | "پایین"; forUs?: boolean };

export const tasks: Task[] = [
  { id: "T-1", title: "خواندن لیست قیمت شیشه‌ها و ساخت جدول قیمت", project: "P-301", assignee: "H-17", due: "۰۸/۰۲", status: "done", priority: "بالا" },
  { id: "T-2", title: "۲۰ تماس آزمایشی و گزارش", project: "P-301", assignee: "H-17", due: "۰۸/۰۶", status: "review", priority: "بالا" },
  { id: "T-3", title: "سنجش تحویل با پروتکل", project: "P-301", assignee: "ایجنت QA", agent: true, due: "۰۸/۰۷", status: "doing", priority: "بالا" },
  { id: "T-4", title: "دسترسی API به CRM مشتری لازم است", project: "P-302", assignee: "ما (کابین)", due: "۰۸/۰۳", status: "todo", priority: "بالا", forUs: true },
  { id: "T-5", title: "نقشه فیلدها بین تلفن و CRM", project: "P-302", assignee: "H-22", due: "۰۸/۰۸", status: "doing", priority: "متوسط" },
  { id: "T-6", title: "نوشتن ۴ پست هفته اول", project: "P-118", assignee: "H-09", due: "۰۸/۰۴", status: "review", priority: "متوسط" },
  { id: "T-7", title: "طراحی ۴ تصویر پست", project: "P-118", assignee: "H-09", due: "۰۸/۰۵", status: "doing", priority: "پایین" },
  { id: "T-8", title: "تحقیق ۲۰ بازار ایتالیا", project: "P-119", assignee: "ایجنت انتخاب بازار", agent: true, due: "۰۸/۱۲", status: "todo", priority: "متوسط" },
];

export const partners = [
  { code: "H-17", name: "NovaAI Studio", kind: "شرکت", role: "تأمین‌کننده تحویل", country: "هلند", skills: ["ایجنت صوتی", "قیمت‌دهی", "n8n"], score: 4.8, jobs: 7, onTime: 96, firstPass: 86, status: "فعال" },
  { code: "H-22", name: "Marco Rossi", kind: "فریلنسر", role: "تأمین‌کننده تحویل", country: "ایتالیا", skills: ["HubSpot", "Zapier", "API"], score: 4.5, jobs: 4, onTime: 90, firstPass: 75, status: "فعال" },
  { code: "H-09", name: "Sara K.", kind: "فریلنسر", role: "همکار داخلی", country: "آلمان", skills: ["لینکدین", "محتوا B2B", "آلمانی"], score: 4.6, jobs: 3, onTime: 100, firstPass: 67, status: "فعال" },
  { code: "AG-content", name: "ایجنت محتوا", kind: "ایجنت", role: "ایجنت", country: "—", skills: ["صفحه صنعت", "مقاله", "ترجمه"], score: 4.2, jobs: 31, onTime: 100, firstPass: 71, status: "فعال" },
  { code: "H-31", name: "VoiceFlow Partners Ltd", kind: "شرکت", role: "تأمین‌کننده تحویل", country: "بریتانیا", skills: ["Voice AI", "Twilio"], score: 0, jobs: 0, onTime: 0, firstPass: 0, status: "درخواست" },
];

export const applications = [
  { name: "VoiceFlow Partners Ltd", kind: "شرکت", country: "بریتانیا", for: "تأمین‌کننده: ایجنت صوتی", aiScore: 82, summary: "۶ سال سابقه Voice AI، ۴۰ پروژه، بیمه مسئولیت دارد، DPA امضا می‌کند." },
  { name: "Lena Hoffmann", kind: "فریلنسر", country: "آلمان", for: "همکار داخلی: فروش تلفنی", aiScore: 74, summary: "۳ سال فروش B2B در صنعت ساختمان، آلمانی مادری." },
  { name: "Arash M.", kind: "فریلنسر", country: "ترکیه", for: "تأمین‌کننده: اتوماسیون n8n", aiScore: 69, summary: "۲۵ ورک‌فلو n8n، نمونه‌کار خوب؛ فقط کار بدون داده شخصی." },
];

export const protocols = [
  {
    id: "PR-01", title: "راه‌اندازی ایجنت قیمت‌دهی", version: "v2", category: "راه‌حل آماده › فروش", used: 6, passRate: 83,
    goal: "۹۰٪ درخواست‌های قیمت زیر ۱۵ دقیقه با دقت ±۳٪ پاسخ داده شوند.",
    inputs: ["لیست قیمت مشتری (Excel یا PDF)", "قوانین تخفیف", "قالب پیشنهاد قیمت با برند ما"],
    criteria: [
      { t: "۲۰ درخواست آزمایشی با دقت ±۳٪", must: true, weight: 30, method: "خودکار" },
      { t: "پاسخ زیر ۱۵ دقیقه در ۹۰٪ موارد", must: true, weight: 20, method: "خودکار" },
      { t: "هیچ نام یا لوگوی همکار در خروجی‌ها نیست (وایت‌لیبل)", must: true, weight: 15, method: "ایجنت QA" },
      { t: "معرفی به‌عنوان AI در هر پیام (AI Act)", must: true, weight: 10, method: "ایجنت QA" },
      { t: "راهنمای کوتاه برای کارمند مشتری", must: false, weight: 15, method: "انسان" },
      { t: "گزارش آزمون با نمونه‌ها", must: false, weight: 10, method: "انسان" },
    ],
  },
  { id: "PR-02", title: "ایجنت پاسخ‌گویی تلفن و چت", version: "v3", category: "راه‌حل آماده › پشتیبانی", used: 9, passRate: 89 },
  { id: "PR-03", title: "اتصال CRM", version: "v1", category: "تحول سفارشی › یکپارچه‌سازی", used: 2, passRate: 50 },
  { id: "PR-04", title: "صفحه صنعت × کشور", version: "v3", category: "داخلی › رسانه", used: 31, passRate: 71 },
  { id: "PR-05", title: "کمپین محتوای لینکدین", version: "v1", category: "داخلی › بازاریابی", used: 1, passRate: 67 },
];

export const qaQueue = [
  { project: "P-301", deliverable: "نسخه ۲ ایجنت قیمت‌دهی + گزارش آزمون", partner: "H-17", protocol: "PR-01 v2", ai: { passed: 5, total: 6, note: "معیار «راهنمای کوتاه» ناقص است: بخش تخفیف‌ها توضیح داده نشده." }, forCustomer: true },
  { project: "P-118", deliverable: "۴ پست هفته اول", partner: "H-09", protocol: "PR-05 v1", ai: { passed: 4, total: 4, note: "همه معیارها برقرار است. لحن با راهنمای برند هم‌خوان است." }, forCustomer: false },
];

export const messages = [
  { from: "them", who: "تیم فنی " + "Legend Partner", text: "سلام آقای Becker، برای اتصال به CRM یک کلید API از HubSpot لازم داریم. راهنمای ساختش را پیوست کردیم." },
  { from: "me", who: "شما", text: "باشه، تا فردا می‌فرستم. آیا داده مشتری‌های ما جایی بیرون از اروپا می‌رود؟" },
  { from: "them", who: "تیم فنی " + "Legend Partner", text: "خیر، همه پردازش‌ها روی سرورهای اتحادیه اروپا انجام می‌شود (طبق قرارداد حفاظت داده)." },
];

export const partnerMessages = [
  { from: "them", who: "Legend Partner (مدیر پروژه)", text: "مشتری C-1042 کلید API را تا فردا می‌فرستد. لطفاً نقشه فیلدها را آماده کن." },
  { from: "me", who: "شما", text: "باشه. می‌شود شماره تلفن مسئول فنی مشتری را بدهید که سریع‌تر هماهنگ کنیم؟" },
  { from: "system", who: "سیستم", text: "⚠️ درخواست تماس مستقیم با مشتری طبق قرارداد همکاری مجاز نیست. هماهنگی از همین فضای کار انجام می‌شود." },
];

export const moderation = [
  { project: "P-302", side: "همکار H-22", original: "my number is +39 333 123 4567, call me", delivered: "my number is [حذف شد], call me", reason: "شماره تلفن", status: "نگه‌داشته‌شده" },
  { project: "P-301", side: "مشتری C-1042", original: "Can you email me at t.becker@glas-becker.de?", delivered: "Can you email me at [حذف شد]?", reason: "ایمیل", status: "تحویل‌شده با پنهان‌سازی" },
];

export const leads = [
  { company: "Fensterbau Müller", city: "مونیخ", industry: "شیشه", stage: "سرنخ", score: 78, source: "ایجنت شکارچی", next: "پیام شخصی آماده تأیید" },
  { company: "Vetreria Bianchi", city: "میلان", industry: "شیشه", stage: "چک‌آپ انجام شد", score: 71, source: "صفحه صنعت", next: "رزرو جلسه" },
  { company: "GlasTec Nord", city: "هامبورگ", industry: "شیشه", stage: "جلسه", score: 85, source: "لینکدین", next: "پیشنهاد قیمت" },
  { company: "Glas Becker GmbH", city: "کلن", industry: "شیشه", stage: "مشتری", score: 92, source: "چک‌آپ", next: "آپسل پله ۳" },
  { company: "Studio Dentale Riva", city: "تورین", industry: "دندان", stage: "سرنخ", score: 64, source: "ایجنت شکارچی", next: "در صف تحقیق" },
];

export const agents = [
  { id: "AG-market", name: "انتخاب بازار", stage: "۰الف", status: "فعال", lastRun: "امروز ۰۶:۰۰", runs: 14, cost: 3.2, output: "۳ فیلتر برتر با امتیاز", n8n: true },
  { id: "AG-hunter", name: "شکارچی سرنخ", stage: "۲", status: "فعال", lastRun: "امروز ۰۷:۱۰", runs: 42, cost: 6.8, output: "۱۲۰ شرکت تازه در فهرست", n8n: true },
  { id: "AG-offer", name: "پیشنهاد شخصی‌سازی‌شده", stage: "۴", status: "منتظر تأیید", lastRun: "دیروز ۱۸:۲۰", runs: 20, cost: 2.1, output: "۲۰ پیام آماده تأیید", n8n: true },
  { id: "AG-content", name: "محتوا و رسانه", stage: "۳", status: "فعال", lastRun: "امروز ۰۵:۳۰", runs: 31, cost: 4.4, output: "۲ صفحه صنعت پیش‌نویس", n8n: true },
  { id: "AG-qa", name: "QA (سنجش تحویل)", stage: "۷", status: "فعال", lastRun: "امروز ۰۷:۴۵", runs: 9, cost: 0.9, output: "۲ تحویل سنجیده شد", n8n: false },
  { id: "AG-screen", name: "غربال همکاران", stage: "داخلی", status: "فعال", lastRun: "امروز ۰۷:۰۰", runs: 3, cost: 0.4, output: "۳ درخواست امتیاز گرفت", n8n: false },
  { id: "AG-mod", name: "ناظر پیام‌ها", stage: "۸", status: "فعال", lastRun: "زنده", runs: 140, cost: 0.6, output: "۲ پیام نشان‌دار", n8n: false },
  { id: "AG-report", name: "گزارش روزانه و ماهانه", stage: "۸", status: "زمان‌بندی‌شده", lastRun: "امروز ۰۷:۳۰", runs: 22, cost: 1.1, output: "خلاصه روزانه جواد", n8n: true },
];

export const markets = [
  { filter: "شیشه × آلمان", demand: 8.6, competition: 6.1, access: 7.8, law: 7.0, margin: 8.0, total: 7.7, status: "فعال" },
  { filter: "شیشه × ایتالیا", demand: 7.9, competition: 7.4, access: 6.5, law: 7.5, margin: 7.2, total: 7.3, status: "نامزد" },
  { filter: "نصاب‌ها × بریتانیا", demand: 8.8, competition: 5.2, access: 8.1, law: 8.0, margin: 7.0, total: 7.4, status: "نامزد" },
  { filter: "دندان × آلمان", demand: 7.1, competition: 4.8, access: 6.0, law: 5.5, margin: 8.4, total: 6.4, status: "رد" },
];

export const contractTypes = [
  { key: "customer", title: "قرارداد خدمات مشتری + DPA", fields: ["نام شرکت مشتری", "خدمات (از کاتالوگ)", "مبلغ ماهانه", "شروع و مدت", "کشور و قانون حاکم"] },
  { key: "supplier", title: "قرارداد همکاری تأمین‌کننده", fields: ["نام همکار", "خدمات و قیمت خرید", "SLA", "کشور", "دسترسی به داده شخصی؟"] },
  { key: "freelancer", title: "قرارداد فریلنسر", fields: ["نام", "نوع کار", "مدت", "مبلغ پروژه‌ای"] },
  { key: "employee", title: "قرارداد کار (کارمند)", fields: ["نام", "سمت", "حقوق", "ساعت کاری"] },
  { key: "nda", title: "NDA", fields: ["طرف مقابل", "موضوع", "مدت"] },
];

export const contracts = [
  { title: "خدمات + DPA", party: "Glas Becker GmbH", template: "customer-de v1.3", status: "امضاشده", renew: "۱۴۰۶/۰۶/۰۱" },
  { title: "همکاری تأمین‌کننده", party: "NovaAI Studio", template: "supplier-eu v1.1", status: "امضاشده", renew: "۱۴۰۶/۰۵/۱۰" },
  { title: "فریلنسر", party: "Sara K.", template: "freelancer-de v1.0", status: "منتظر امضا", renew: "—" },
];

export const invoices = [
  { no: "LP-2026-0041", period: "مهر ۱۴۰۵", amount: 1190, status: "پرداخت‌شده" },
  { no: "LP-2026-0052", period: "آبان ۱۴۰۵", amount: 1190, status: "منتظر پرداخت" },
  { no: "LP-2026-0029", period: "شهریور ۱۴۰۵", amount: 680, status: "پرداخت‌شده" },
];

export const reports = [
  { month: "مهر ۱۴۰۵", hours: 46, jobs: 9, calls: 312, highlight: "زمان قیمت‌دهی از ۲ روز به ۱۲ دقیقه رسید." },
  { month: "شهریور ۱۴۰۵", hours: 31, jobs: 6, calls: 280, highlight: "ایجنت تلفن ۹۷٪ تماس‌ها را پاسخ داد." },
];

export const earnings = [
  { period: "مهر ۱۴۰۵", project: "P-288", amount: 1100, status: "پرداخت‌شده" },
  { period: "آبان ۱۴۰۵", project: "P-301", amount: 1300, status: "پس از تأیید QA" },
];

// ── Customer dashboard additions (doc 15 §6و) ──
export const myApps = [
  { id: "quote", icon: "🧮", name: "ایجنت قیمت‌دهی شیشه", mode: "native" as const, status: "فعال", stat: "۸۴ قیمت این ماه · میانگین ۱۲ دقیقه", usage: 84 },
  { id: "phone", icon: "📞", name: "پاسخ‌گوی ۲۴ ساعته تلفن و چت", mode: "embedded" as const, status: "فعال", stat: "۳۱۲ تماس · ۹۷٪ پاسخ", usage: 97 },
  { id: "followup", icon: "🔁", name: "پیگیری خودکار پیشنهادها", mode: "sso" as const, status: "در حال راه‌اندازی", stat: "فعال‌سازی تا ۲ روز دیگر", usage: 0 },
];
export const appModeLabel = { native: "بومی (ساخت ما)", embedded: "جاسازی‌شده با برند ما", sso: "ورود یک‌کلیکی" };
export const connections = [
  { name: "HubSpot CRM", kind: "OAuth", status: "وصل" },
  { name: "Outlook / Microsoft 365", kind: "OAuth", status: "وصل" },
  { name: "DATEV", kind: "API", status: "درخواست اتصال" },
];
export const onboarding = [
  { t: "چک‌آپ رایگان", done: true },
  { t: "امضای قرارداد و DPA", done: true },
  { t: "اتصال ایمیل و تقویم", done: true },
  { t: "اولین ایجنت فعال شد", done: true },
  { t: "اتصال CRM (کلید HubSpot)", done: false },
  { t: "دعوت یک همکار به داشبورد", done: false },
];
export const insights = [
  { tone: "warn", t: "۱۱ درخواست قیمت دیروز بیرون از ساعت کاری آمد و ۴ تا هنوز جواب نگرفته‌اند.", act: "فعال‌سازی پاسخ شبانه" },
  { tone: "ok", t: "قیمت شیشه تخت ۴٪ پایین آمد؛ ۷ پیشنهاد قیمت باز را می‌شود به‌روز کرد.", act: "به‌روزرسانی پیشنهادها" },
  { tone: "ai", t: "شرکت‌های مشابه شما با «رزرو خودکار بازدید» ماهی ۶ کار بیشتر گرفته‌اند.", act: "دیدن پیشنهاد" },
];
export const customerApprovals = [
  { t: "تحویل: نسخه ۲ ایجنت قیمت‌دهی (پروژه P-301)", kind: "تحویل" },
  { t: "درخواست تغییر: افزودن قیمت شیشه رنگی (+€180، +۳ روز)", kind: "تغییر دامنه" },
  { t: "متن خوش‌آمد تلفن به ایتالیایی", kind: "محتوا" },
];
export const tickets = [
  { no: "TK-208", t: "ایجنت تلفن شماره داخلی ۲۲ را نمی‌شناسد", status: "در حال بررسی", sla: "پاسخ تا ۴ ساعت" },
  { no: "TK-201", t: "اضافه کردن کاربر حسابداری", status: "تمام", sla: "—" },
];
export const activity = [
  { who: "Thomas Becker", what: "تحویل P-301 مرحله ۳ را تأیید کرد", when: "دیروز ۱۷:۲۰" },
  { who: "Anna Becker", what: "فاکتور LP-2026-0041 را دانلود کرد", when: "۲ روز پیش" },
  { who: "ایجنت قیمت‌دهی", what: "۱۴ پیش‌فاکتور فرستاد", when: "امروز" },
];

// ── Partner portal additions (doc 15 §6ب, final) ──
export const jobOffers = [
  { id: "J-77", title: "اتصال فرم سایت به HubSpot", customer: "C-1077", hub: "نصاب‌ها × بریتانیا", protocol: "اتصال CRM v1", days: 5, pay: 700, fit: 94, why: "۴ پروژه HubSpot موفق، ظرفیت آزاد این هفته، رتبه ۲ در این نوع کار" },
  { id: "J-81", title: "نقشه فیلد تلفن ← Pipedrive", customer: "C-1090", hub: "شیشه × ایتالیا", protocol: "اتصال CRM v1", days: 3, pay: 450, fit: 81, why: "زبان ایتالیایی، تجربه API؛ Pipedrive را کمتر کار کرده‌اید" },
  { id: "J-83", title: "داشبورد گزارش ماهانه در Looker", customer: "C-1042", hub: "شیشه × آلمان", protocol: "گزارش ماهانه v2", days: 4, pay: 520, fit: 63, why: "مهارت Looker در پروفایل نیست" },
];
export const vault = [
  { t: "شماره مالیاتی (Partita IVA)", status: "تأییدشده", exp: "—" },
  { t: "قرارداد همکاری + منع دور زدن", status: "امضاشده", exp: "۱۴۰۶/۰۵/۱۰" },
  { t: "NDA", status: "امضاشده", exp: "۱۴۰۷/۰۱/۰۱" },
  { t: "بیمه مسئولیت حرفه‌ای", status: "منقضی می‌شود", exp: "۱۴۰۵/۰۹/۰۱" },
];
export const tiers = [
  { name: "تازه‌وارد", min: 0 },
  { name: "تأییدشده", min: 3 },
  { name: "حرفه‌ای", min: 10 },
  { name: "برتر", min: 25 },
];
export const courses = [
  { t: "اصول white-label و قواعد ارتباط با مشتری", min: 12, done: true },
  { t: "پروتکل «اتصال CRM v1»: معیارها و نمونه تحویل خوب", min: 18, done: true },
  { t: "n8n پیشرفته: خطاگیری و تکرار", min: 25, done: false },
  { t: "AI Act برای سازندگان ایجنت", min: 15, done: false },
];
