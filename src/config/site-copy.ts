// Interface text of the public site, one dictionary per language (doc 15 §6ه.4: multilingual everywhere).
// A new language = one more dictionary here (later: message files filled by the translation agent + approval).
// Page content itself (hubs, products, articles) comes from the database per locale.

const en = {
  nav: { market: "Solutions", hubs: "Industries", tools: "Free tools", media: "Insights", partners: "Work with us", login: "Client login", checkup: "Free check-up" },
  hero: {
    kicker: "The AI gateway for European SMEs",
    title: ["Tell us your problem.", "We find the AI that solves it."],
    lead: "We don't sell software, we sell outcomes: we pick, install and run the world's best AI for your industry and report the savings every month.",
    proof: ["AI-powered, humans approve", "Data stays in the EU", "No long-term contract"],
  },
  chat: {
    title: "Ask our AI advisor",
    disclosure: "You are talking to an AI. Answers come from our approved catalogue; a human checks offers.",
    placeholder: "e.g. We lose phone calls and quotes take two days…",
    send: "Send",
    examples: ["We miss calls", "Quotes are slow", "Too much paperwork"],
    hello: "Hi! I'm the advisor of {brand}. Describe a problem in your company and I'll show you what solves it, with real numbers.",
    live: "Matched to your need",
    liveEmpty: "As you chat, solutions, case studies and tools that fit your need appear here.",
    book: "Book a 20-minute call",
    start: "Start free check-up",
  },
  ladder: { title: "Solution ladder", sub: "Start free; take the next step only when the last one paid off.", cta: "Start", items: [
    { n: 1, title: "Free AI check-up", desc: "Where AI saves you time and money, with a readiness score.", price: "Free", free: true },
    { n: 2, title: "Ready solution", desc: "One proven agent for one clear problem, run by us.", price: "from €190/month" },
    { n: 3, title: "Custom transformation", desc: "AI connected to your CRM, accounting, phone, stock.", price: "project + monthly" },
    { n: 4, title: "Technology partner", desc: "We scout, test and roll out new tools for you.", price: "from €900/month" },
    { n: 5, title: "Company persona", desc: "Your company's own AI that works with other companies' agents.", price: "monthly" },
  ] },
  hubs: { title: "Your industry, your country", sub: "Each hub is a daily reference and a small professional network for one trade in one country.", open: "Open hub", soon: "Coming soon", companies: "companies" },
  market: { title: "Solutions for your industry", sub: "No generic store: pick your industry and see only what works for it.", pick: "Choose your industry", from: "from", per: "/month", view: "Details" },
  tools: { title: "Free tools", sub: "Useful on day one, no sign-up needed." },
  band: { title: "See where AI makes money in your company", sub: "Free, no sales call, instant result.", cta: "Start the check-up" },
  newsletter: { title: "Weekly brief for your industry", sub: "News, innovations and tenders for your trade. Double opt-in, unsubscribe any time.", placeholder: "Work email", cta: "Subscribe", ok: "Check your inbox to confirm." },
  cookie: { text: "We use cookies only with your consent: necessary ones always, analytics to improve the site. No tracking before you choose.", accept: "Accept all", reject: "Necessary only", settings: "Settings" },
  footer: { about: "The technology partner for European SMEs. We pick and run the world's best tools for you.", company: "Company", forAgents: "For agents", legal: "Legal notice & privacy", referral: "Refer a company, earn 10% of its first year", rights: "Demo version" },
  personal: { welcome: "Welcome back", yourHub: "Your hub", all: "See all industries" },
};

export type SiteCopy = typeof en;

const fa: SiteCopy = {
  nav: { market: "راه‌حل‌ها", hubs: "صنایع", tools: "ابزار رایگان", media: "رسانه", partners: "همکاری با ما", login: "ورود مشتریان", checkup: "چک‌آپ رایگان" },
  hero: {
    kicker: "دروازه AI برای شرکت‌های کوچک و متوسط اروپا",
    title: ["مشکلتان را بگویید.", "ما AIای را که حلش می‌کند پیدا می‌کنیم."],
    lead: "ما ابزار نمی‌فروشیم، نتیجه می‌فروشیم: بهترین هوش مصنوعی‌های دنیا را برای صنعت شما انتخاب، نصب و اداره می‌کنیم و هر ماه گزارش صرفه‌جویی می‌دهیم.",
    proof: ["با AI، با تأیید انسان", "داده‌ها در اتحادیه اروپا", "بدون قرارداد بلندمدت"],
  },
  chat: {
    title: "از مشاور AI ما بپرسید",
    disclosure: "شما با AI صحبت می‌کنید. پاسخ‌ها از کاتالوگ تأییدشده ماست و پیشنهادها را انسان بررسی می‌کند.",
    placeholder: "مثلاً: تماس‌ها را از دست می‌دهیم و قیمت‌دهی دو روز طول می‌کشد…",
    send: "ارسال",
    examples: ["تماس‌ها از دست می‌رود", "قیمت‌دهی کند است", "کاغذبازی زیاد است"],
    hello: "سلام! من مشاور {brand} هستم. مشکلی را که در شرکتتان دارید بگویید تا با عدد واقعی نشان بدهم چه چیزی حلش می‌کند.",
    live: "متناسب با نیاز شما",
    liveEmpty: "همین که صحبت می‌کنید، راه‌حل‌ها، نمونه‌کارها و ابزارهای مرتبط اینجا ظاهر می‌شوند.",
    book: "رزرو تماس ۲۰ دقیقه‌ای",
    start: "شروع چک‌آپ رایگان",
  },
  ladder: { title: "نردبان راه‌حل‌ها", sub: "رایگان شروع کنید؛ پله بعد فقط وقتی که پله قبل نتیجه داد.", cta: "شروع", items: [
    { n: 1, title: "چک‌آپ رایگان AI", desc: "کجا AI وقت و پول شما را نجات می‌دهد، با امتیاز آمادگی.", price: "رایگان", free: true },
    { n: 2, title: "راه‌حل آماده", desc: "یک ایجنت آزموده برای یک مشکل مشخص، با اداره ما.", price: "از €190 در ماه" },
    { n: 3, title: "تحول سفارشی", desc: "اتصال AI به CRM، حسابداری، تلفن و انبار شما.", price: "پروژه + ماهانه" },
    { n: 4, title: "شریک دائمی تکنولوژی", desc: "ابزارهای تازه را برایتان رصد، آزمایش و اجرا می‌کنیم.", price: "از €900 در ماه" },
    { n: 5, title: "پرسونای شرکت", desc: "AI اختصاصی شرکت شما که با ایجنت‌های شرکت‌های دیگر کار می‌کند.", price: "ماهانه" },
  ] },
  hubs: { title: "صنعت شما، کشور شما", sub: "هر هاب مرجع روزانه و شبکه حرفه‌ای کوچک یک صنف در یک کشور است.", open: "ورود به هاب", soon: "به‌زودی", companies: "شرکت" },
  market: { title: "راه‌حل‌های صنعت شما", sub: "فروشگاه عمومی نیستیم: صنعتتان را انتخاب کنید تا فقط چیزهایی را ببینید که برایش کار می‌کند.", pick: "صنعت خود را انتخاب کنید", from: "از", per: "/ماه", view: "جزئیات" },
  tools: { title: "ابزارهای رایگان", sub: "از روز اول مفید، بدون ثبت‌نام." },
  band: { title: "ببینید AI در شرکت شما کجا پول می‌سازد", sub: "رایگان، بدون تماس فروش، نتیجه فوری.", cta: "شروع چک‌آپ" },
  newsletter: { title: "خلاصه هفتگی صنعت شما", sub: "خبر، نوآوری و مناقصه‌های صنف شما. با تأیید دوباره ایمیل؛ لغو در هر زمان.", placeholder: "ایمیل کاری", cta: "عضویت", ok: "ایمیلتان را برای تأیید ببینید." },
  cookie: { text: "کوکی‌ها فقط با رضایت شما: ضروری‌ها همیشه، آماری برای بهبود سایت. پیش از انتخاب شما هیچ ردیابی نیست.", accept: "قبول همه", reject: "فقط ضروری", settings: "تنظیمات" },
  footer: { about: "شریک فناوری شرکت‌های کوچک و متوسط اروپا. بهترین ابزارهای دنیا را برایتان انتخاب و اداره می‌کنیم.", company: "شرکت", forAgents: "برای ایجنت‌ها", legal: "اطلاعات حقوقی و حریم خصوصی", referral: "یک شرکت معرفی کنید و ۱۰٪ سال اولش را بگیرید", rights: "نسخه نمایشی" },
  personal: { welcome: "خوش برگشتید", yourHub: "هاب شما", all: "دیدن همه صنعت‌ها" },
};

const de: SiteCopy = {
  ...en,
  nav: { market: "Lösungen", hubs: "Branchen", tools: "Gratis-Tools", media: "Wissen", partners: "Mit uns arbeiten", login: "Kunden-Login", checkup: "Gratis-Check" },
  hero: { kicker: "Das KI-Tor für den europäischen Mittelstand", title: ["Nennen Sie uns Ihr Problem.", "Wir finden die KI, die es löst."], lead: "Wir verkaufen keine Software, sondern Ergebnisse: Wir wählen, installieren und betreiben die beste KI für Ihre Branche und berichten jeden Monat die Ersparnis.", proof: ["KI-gestützt, Menschen geben frei", "Daten bleiben in der EU", "Kein Langzeitvertrag"] },
  chat: { ...en.chat, title: "Fragen Sie unseren KI-Berater", disclosure: "Sie sprechen mit einer KI. Antworten stammen aus unserem geprüften Katalog; Angebote prüft ein Mensch.", placeholder: "z. B. Wir verpassen Anrufe und Angebote dauern zwei Tage…", send: "Senden", examples: ["Wir verpassen Anrufe", "Angebote sind langsam", "Zu viel Papierkram"], hello: "Hallo! Ich bin der Berater von {brand}. Beschreiben Sie ein Problem und ich zeige Ihnen, was es löst – mit echten Zahlen.", live: "Passend zu Ihrem Bedarf", liveEmpty: "Während Sie schreiben, erscheinen hier passende Lösungen, Fallstudien und Tools.", book: "20-Minuten-Termin buchen", start: "Gratis-Check starten" },
  hubs: { title: "Ihre Branche, Ihr Land", sub: "Jeder Hub ist tägliche Referenz und kleines Fachnetzwerk einer Branche in einem Land.", open: "Hub öffnen", soon: "Bald verfügbar", companies: "Unternehmen" },
  market: { title: "Lösungen für Ihre Branche", sub: "Kein Gemischtwarenladen: Branche wählen und nur sehen, was dafür funktioniert.", pick: "Branche wählen", from: "ab", per: "/Monat", view: "Details" },
  tools: { title: "Gratis-Tools", sub: "Ab Tag eins nützlich, ohne Anmeldung." },
  band: { title: "Sehen Sie, wo KI in Ihrem Betrieb Geld verdient", sub: "Kostenlos, kein Verkaufsgespräch, sofortiges Ergebnis.", cta: "Check starten" },
  newsletter: { title: "Wöchentlicher Branchen-Brief", sub: "News, Innovationen und Ausschreibungen. Double-Opt-in, jederzeit abbestellbar.", placeholder: "Geschäftliche E-Mail", cta: "Abonnieren", ok: "Bitte bestätigen Sie die E-Mail." },
  cookie: { text: "Cookies nur mit Ihrer Einwilligung: notwendige immer, Statistik zur Verbesserung. Kein Tracking vor Ihrer Wahl.", accept: "Alle akzeptieren", reject: "Nur notwendige", settings: "Einstellungen" },
  footer: { about: "Der Technologiepartner für den europäischen Mittelstand.", company: "Unternehmen", forAgents: "Für Agenten", legal: "Impressum & Datenschutz", referral: "Empfehlen Sie ein Unternehmen und erhalten Sie 10 % des ersten Jahres", rights: "Demoversion" },
  personal: { welcome: "Willkommen zurück", yourHub: "Ihr Hub", all: "Alle Branchen anzeigen" },
};

const it: SiteCopy = {
  ...en,
  nav: { market: "Soluzioni", hubs: "Settori", tools: "Strumenti gratuiti", media: "Approfondimenti", partners: "Lavora con noi", login: "Area clienti", checkup: "Check-up gratuito" },
  hero: { kicker: "La porta d'accesso all'IA per le PMI europee", title: ["Diteci il vostro problema.", "Troviamo l'IA che lo risolve."], lead: "Non vendiamo software, vendiamo risultati: scegliamo, installiamo e gestiamo la migliore IA per il vostro settore e ogni mese riportiamo i risparmi.", proof: ["IA, con approvazione umana", "Dati nell'UE", "Nessun contratto lungo"] },
  chat: { ...en.chat, title: "Chiedi al nostro consulente IA", disclosure: "Stai parlando con un'IA. Le risposte vengono dal nostro catalogo approvato; le offerte sono verificate da una persona.", placeholder: "es. Perdiamo chiamate e i preventivi richiedono due giorni…", send: "Invia", examples: ["Perdiamo chiamate", "Preventivi lenti", "Troppa burocrazia"], hello: "Ciao! Sono il consulente di {brand}. Descrivi un problema e ti mostro cosa lo risolve, con numeri reali.", live: "In base alla tua esigenza", liveEmpty: "Mentre scrivi, qui compaiono soluzioni, casi e strumenti adatti.", book: "Prenota una call di 20 minuti", start: "Inizia il check-up" },
  hubs: { title: "Il tuo settore, il tuo paese", sub: "Ogni hub è un riferimento quotidiano e una piccola rete professionale di un settore in un paese.", open: "Apri hub", soon: "Presto", companies: "aziende" },
  market: { title: "Soluzioni per il tuo settore", sub: "Nessun negozio generico: scegli il settore e vedi solo ciò che funziona.", pick: "Scegli il settore", from: "da", per: "/mese", view: "Dettagli" },
  tools: { title: "Strumenti gratuiti", sub: "Utili dal primo giorno, senza registrazione." },
  band: { title: "Scopri dove l'IA fa guadagnare la tua azienda", sub: "Gratis, nessuna chiamata commerciale, risultato immediato.", cta: "Inizia il check-up" },
  newsletter: { title: "Brief settimanale del tuo settore", sub: "Notizie, innovazioni e gare. Doppio opt-in, disiscrizione in ogni momento.", placeholder: "Email di lavoro", cta: "Iscriviti", ok: "Conferma dalla tua email." },
  cookie: { text: "Cookie solo con il tuo consenso: necessari sempre, statistici per migliorare il sito. Nessun tracciamento prima della scelta.", accept: "Accetta tutti", reject: "Solo necessari", settings: "Impostazioni" },
  footer: { about: "Il partner tecnologico delle PMI europee.", company: "Azienda", forAgents: "Per agenti", legal: "Note legali e privacy", referral: "Segnala un'azienda e ricevi il 10% del primo anno", rights: "Versione demo" },
  personal: { welcome: "Bentornato", yourHub: "Il tuo hub", all: "Vedi tutti i settori" },
};

const dictionaries: Record<string, SiteCopy> = { "en-gb": en, "de-de": de, "it-it": it, "fa-ir": fa };
export const copyFor = (locale: string): SiteCopy => dictionaries[locale] ?? en;
