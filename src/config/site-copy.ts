// Interface text of the public site prototype. Real page content comes from Postgres (content module);
// this is only the frame around it until the content agent writes the pages.
import { ladder as faLadder, industries as faIndustries } from "@/mock/data";

const fa = {
  nav: { solutions: "راه‌حل‌ها", industries: "صنایع", media: "رسانه", partners: "همکاری با ما", login: "ورود مشتریان", checkup: "چک‌آپ رایگان" },
  hero: {
    kicker: "دروازه AI برای شرکت‌های کوچک و متوسط اروپا",
    title: ["وقتی شرکتتان مشکلی دارد،", "اولین تماس با ماست."],
    lead: "ما ابزار نمی‌فروشیم، نتیجه می‌فروشیم: بهترین هوش مصنوعی‌های دنیا را برای صنعت شما انتخاب، نصب و اداره می‌کنیم و هر ماه گزارش صرفه‌جویی می‌دهیم.",
    primary: "چک‌آپ رایگان ۳ دقیقه‌ای",
    secondary: "ببینید چطور کار می‌کنیم",
    proof: ["بدون قرارداد بلندمدت", "داده‌ها در اتحادیه اروپا", "یک نقطه تماس برای همه چیز"],
  },
  heroCard: { title: "نمونه نتیجه چک‌آپ", company: "شیشه‌بری ۱۲ نفره، مونیخ", score: "آمادگی AI", save: "صرفه‌جویی ممکن", hours: "ساعت در ماه", items: ["پاسخ خودکار به درخواست قیمت", "یادآوری و پیگیری مشتری", "ورود خودکار فاکتورها"] },
  ladder: { title: "نردبان راه‌حل‌ها", sub: "از یک چک‌آپ رایگان شروع کنید؛ هر پله فقط وقتی که پله قبل نتیجه داد.", items: faLadder, cta: "شروع" },
  industries: { title: "برای صنعت شما ساخته شده", sub: "هر صنعت و هر کشور صفحه، مثال و ایجنت‌های مخصوص خودش را دارد.", painLabel: "دردهای رایج:", more: "صفحه صنعت" , items: faIndustries },
  how: { title: "چطور کار می‌کنیم", items: [
    { t: "چک‌آپ", d: "۳ دقیقه سؤال، بعد امتیاز آمادگی و ۳ فرصت اول." },
    { t: "پیشنهاد", d: "مشاور AI شما راه‌حل و هزینه را شفاف پیشنهاد می‌دهد." },
    { t: "راه‌اندازی", d: "تیم و ایجنت‌های ما نصب و اتصال را انجام می‌دهند." },
    { t: "نتیجه ماهانه", d: "داشبورد و گزارش ماهانه: چقدر وقت و پول نجات یافت." },
  ] },
  latest: { title: "تازه‌ها از رسانه ما", empty: "هنوز مطلبی منتشر نشده؛ ایجنت محتوا پیش‌نویس می‌نویسد و پس از تأیید اینجا می‌آید." },
  band: { title: "ببینید AI در شرکت شما کجا پول می‌سازد", sub: "رایگان، بدون تماس فروش، نتیجه فوری.", cta: "شروع چک‌آپ" },
  footer: { about: "شریک فناوری شرکت‌های کوچک و متوسط اروپا. ما بهترین ابزارهای دنیا را برای شما انتخاب و اداره می‌کنیم.", company: "شرکت", forAgents: "برای ایجنت‌ها", rights: "نسخه نمایشی" },
};

const en: typeof fa = {
  nav: { solutions: "Solutions", industries: "Industries", media: "Insights", partners: "Work with us", login: "Client login", checkup: "Free check-up" },
  hero: {
    kicker: "The AI gateway for European SMEs",
    title: ["When your company has a problem,", "we are the first call."],
    lead: "We don't sell software, we sell outcomes: we pick, install and run the world's best AI for your industry, and report the savings every month.",
    primary: "3-minute free check-up",
    secondary: "See how it works",
    proof: ["No long-term contract", "Data stays in the EU", "One point of contact"],
  },
  heroCard: { title: "Sample check-up result", company: "12-person glazier, Munich", score: "AI readiness", save: "Possible savings", hours: "hours per month", items: ["Automatic quote replies", "Customer follow-ups", "Automatic invoice entry"] },
  ladder: { title: "Solution ladder", sub: "Start with a free check-up; take the next step only when the last one paid off.", cta: "Start", items: [
    { n: 1, title: "Free AI check-up", desc: "Where AI saves you time and money, with a readiness score and roadmap.", price: "Free", free: true },
    { n: 2, title: "Ready solution", desc: "One proven agent for one clear problem, set up and supervised by us.", price: "from €290/month" },
    { n: 3, title: "Custom transformation", desc: "AI connected to your own systems: CRM, accounting, phone, stock.", price: "project + monthly" },
    { n: 4, title: "Technology partner", desc: "We scout, test and roll out new tools for you.", price: "from €900/month" },
    { n: 5, title: "Company persona", desc: "Your company's own AI that works with other companies' agents.", price: "monthly" },
  ] },
  industries: { title: "Built for your industry", sub: "Every industry and country gets its own pages, examples and agents.", painLabel: "Typical pains:", more: "Industry page", items: [
    { slug: "glass", icon: "🪟", name: "Glass & windows", pain: "Slow quotes, missed calls", markets: ["Germany", "Italy"] },
    { slug: "installers", icon: "🔧", name: "Installers & trades", pain: "Visit scheduling, follow-ups", markets: ["UK", "Germany"] },
    { slug: "dental", icon: "🦷", name: "Dental clinics", pain: "Booking, reminders, 24h answers", markets: ["Germany"] },
    { slug: "logistics", icon: "🚚", name: "Transport & logistics", pain: "Order tracking, documents, quotes", markets: ["Italy"] },
    { slug: "real-estate", icon: "🏢", name: "Real estate", pain: "Lead replies, viewings", markets: ["UAE", "Germany"] },
    { slug: "manufacturing", icon: "🏭", name: "Small manufacturers", pain: "Forecasting, QC, orders", markets: ["Italy", "Germany"] },
  ] },
  how: { title: "How it works", items: [
    { t: "Check-up", d: "3 minutes of questions, then a readiness score and your first 3 opportunities." },
    { t: "Proposal", d: "Your AI advisor proposes the solution and the price, transparently." },
    { t: "Setup", d: "Our team and agents install and connect everything." },
    { t: "Monthly results", d: "Dashboard and monthly report: time and money saved." },
  ] },
  latest: { title: "Latest insights", empty: "Nothing published yet; the content agent drafts, and pages appear here after approval." },
  band: { title: "See where AI makes money in your company", sub: "Free, no sales call, instant result.", cta: "Start the check-up" },
  footer: { about: "The technology partner for European SMEs. We pick and run the world's best tools for you.", company: "Company", forAgents: "For agents", rights: "Demo version" },
};

export type SiteCopy = typeof fa;
export const copyFor = (locale: string): SiteCopy => (locale.startsWith("fa") ? fa : en);
