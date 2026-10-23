// Interface text of the public site, one dictionary per language (doc 15 §6ه.4: multilingual everywhere).
// A new language = one more dictionary here (later: message files filled by the translation agent + approval).
// Page content itself (hubs, products, articles) comes from the database per locale.

const en = {
  nav: { market: "Solutions", hubs: "Industries", myIndustry: "My industry", explore: "Explore", change: "Change industry", signup: "Create account", tools: "Free tools", media: "Insights", partners: "Work with us", login: "Client login", checkup: "Free check-up" },
  hero: {
    kicker: "The technology partner for European SMEs",
    title: ["You don't need AI.", "You need the problem gone."],
    lead: "Stop buying software. Start buying results. We find, set up and run whatever fixes it best for your industry, and report the savings every month.",
    proof: ["Paid for results", "Data stays in the EU", "No long-term contract"],
  },
  chat: {
    title: "Ask our advisor",
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
    { n: 1, title: "Free check-up", desc: "Where your company loses time and money, and what fixes it first.", price: "Free", free: true },
    { n: 2, title: "Ready solution", desc: "One proven agent for one clear problem, run by us.", price: "from €190/month" },
    { n: 3, title: "Custom transformation", desc: "Tools wired into your CRM, accounting, phone and stock.", price: "project + monthly" },
    { n: 4, title: "Technology partner", desc: "We scout, test and roll out new tools for you.", price: "from €900/month" },
    { n: 5, title: "Company persona", desc: "Your company's own digital assistant that deals with other companies for you.", price: "monthly" },
  ] },
  hubs: { title: "Your industry", sub: "One hub per trade: daily news, solutions, a company directory and a small professional network. Pick your country inside the hub.", open: "Open hub", soon: "Coming soon", companies: "companies" },
  market: { title: "Solutions for your industry", sub: "No generic store: pick your industry and see only what works for it.", pick: "Choose your industry", from: "from", per: "/month", view: "Details" },
  tools: { title: "Free tools", sub: "Useful on day one, no sign-up needed." },
  band: { title: "See where your company leaks money", sub: "Free, no sales call, instant result.", cta: "Start the check-up" },
  newsletter: { title: "Weekly brief for your industry", sub: "News, innovations and tenders for your trade. Double opt-in, unsubscribe any time.", placeholder: "Work email", cta: "Subscribe", ok: "Check your inbox to confirm." },
  cookie: { text: "We use cookies only with your consent: necessary ones always, analytics to improve the site. No tracking before you choose.", accept: "Accept all", reject: "Necessary only", settings: "Settings" },
  footer: { about: "Every company deserves a world-class tech team. We pick and run the best tools for you.", company: "Company", forAgents: "For agents", legal: "Legal notice & privacy", referral: "Refer a company, earn 10% of its first year", rights: "Demo version" },
  explore: { title: "Explore all industries", sub: "The full standard tree (NACE): sector › sub-industry › country. Pick yours and the whole site adapts to it.", search: "Search an industry or NACE code", live: "Open hub", soon: "Coming soon", request: "Request this industry", requested: "Thanks, noted. We open industries by demand.", none: "Nothing found. Try the check-up and tell us your trade." },
  about: { title: "About us", vision: "Every company deserves a world-class tech team. We're building it, for every industry, in every country.", points: ["We are not a software vendor. We are measured by the problems we remove.", "We pick the best tool for each job, whoever makes it, and run it for you.", "One specialist team per industry, so you never explain your trade from scratch."] },
  personal: { welcome: "Welcome back", yourHub: "Your hub", all: "See all industries" },
};

export type SiteCopy = typeof en;

const fa: SiteCopy = {
  nav: { market: "راه‌حل‌ها", hubs: "صنایع", myIndustry: "صنعت من", explore: "کاوش صنایع", change: "تغییر صنعت", signup: "ساخت حساب", tools: "ابزار رایگان", media: "رسانه", partners: "همکاری با ما", login: "ورود مشتریان", checkup: "چک‌آپ رایگان" },
  hero: {
    kicker: "شریک فناوری شرکت‌های کوچک و متوسط اروپا",
    title: ["شما AI لازم ندارید.", "لازم دارید مشکلتان حل شود."],
    lead: "نرم‌افزار نخرید، نتیجه بخرید. ما هر چیزی را که مشکل صنعت شما را بهتر از همه حل می‌کند پیدا، راه‌اندازی و اداره می‌کنیم و هر ماه صرفه‌جویی را گزارش می‌دهیم.",
    proof: ["پرداخت برای نتیجه", "داده‌ها در اتحادیه اروپا", "بدون قرارداد بلندمدت"],
  },
  chat: {
    title: "از مشاور ما بپرسید",
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
    { n: 1, title: "چک‌آپ رایگان", desc: "شرکت شما کجا وقت و پول از دست می‌دهد و اول چه چیزی درستش می‌کند.", price: "رایگان", free: true },
    { n: 2, title: "راه‌حل آماده", desc: "یک ایجنت آزموده برای یک مشکل مشخص، با اداره ما.", price: "از €190 در ماه" },
    { n: 3, title: "تحول سفارشی", desc: "ابزارها وصل به CRM، حسابداری، تلفن و انبار شما.", price: "پروژه + ماهانه" },
    { n: 4, title: "شریک دائمی تکنولوژی", desc: "ابزارهای تازه را برایتان رصد، آزمایش و اجرا می‌کنیم.", price: "از €900 در ماه" },
    { n: 5, title: "پرسونای شرکت", desc: "دستیار دیجیتال اختصاصی شرکت شما که به‌جای شما با شرکت‌های دیگر کار می‌کند.", price: "ماهانه" },
  ] },
  hubs: { title: "صنعت شما", sub: "برای هر صنف یک هاب: خبر روزانه، راه‌حل‌ها، دایرکتوری شرکت‌ها و یک شبکه حرفه‌ای کوچک. کشور را داخل خود هاب انتخاب کنید.", open: "ورود به هاب", soon: "به‌زودی", companies: "شرکت" },
  market: { title: "راه‌حل‌های صنعت شما", sub: "فروشگاه عمومی نیستیم: صنعتتان را انتخاب کنید تا فقط چیزهایی را ببینید که برایش کار می‌کند.", pick: "صنعت خود را انتخاب کنید", from: "از", per: "/ماه", view: "جزئیات" },
  tools: { title: "ابزارهای رایگان", sub: "از روز اول مفید، بدون ثبت‌نام." },
  band: { title: "ببینید شرکت شما کجا پول از دست می‌دهد", sub: "رایگان، بدون تماس فروش، نتیجه فوری.", cta: "شروع چک‌آپ" },
  newsletter: { title: "خلاصه هفتگی صنعت شما", sub: "خبر، نوآوری و مناقصه‌های صنف شما. با تأیید دوباره ایمیل؛ لغو در هر زمان.", placeholder: "ایمیل کاری", cta: "عضویت", ok: "ایمیلتان را برای تأیید ببینید." },
  cookie: { text: "کوکی‌ها فقط با رضایت شما: ضروری‌ها همیشه، آماری برای بهبود سایت. پیش از انتخاب شما هیچ ردیابی نیست.", accept: "قبول همه", reject: "فقط ضروری", settings: "تنظیمات" },
  footer: { about: "شریک فناوری شرکت‌های کوچک و متوسط اروپا. بهترین ابزارهای دنیا را برایتان انتخاب و اداره می‌کنیم.", company: "شرکت", forAgents: "برای ایجنت‌ها", legal: "اطلاعات حقوقی و حریم خصوصی", referral: "یک شرکت معرفی کنید و ۱۰٪ سال اولش را بگیرید", rights: "نسخه نمایشی" },
  explore: { title: "کاوش همه صنایع", sub: "درخت کامل استاندارد (NACE): بخش › زیرصنعت › کشور. صنعت خودتان را انتخاب کنید تا کل سایت برای آن تنظیم شود.", search: "جستجوی صنعت یا کد NACE", live: "ورود به هاب", soon: "به‌زودی", request: "درخواست این صنعت", requested: "ممنون، ثبت شد. صنعت‌ها بر اساس تقاضا باز می‌شوند.", none: "چیزی پیدا نشد. چک‌آپ را بزنید و صنف خود را بگویید." },
  about: { title: "درباره ما", vision: "هر شرکتی لایق یک تیم فنی در سطح جهانی است. ما آن را می‌سازیم، برای هر صنعت و در هر کشور.", points: ["ما فروشنده نرم‌افزار نیستیم. با مشکلاتی که برطرف می‌کنیم سنجیده می‌شویم.", "برای هر کار بهترین ابزار را انتخاب می‌کنیم، هر کس که آن را ساخته باشد، و برایتان اداره‌اش می‌کنیم.", "برای هر صنعت یک تیم متخصص، تا هیچ‌وقت لازم نباشد کارتان را از صفر توضیح دهید."] },
  personal: { welcome: "خوش برگشتید", yourHub: "هاب شما", all: "دیدن همه صنعت‌ها" },
};

const de: SiteCopy = {
  ...en,
  nav: { market: "Lösungen", hubs: "Branchen", myIndustry: "Meine Branche", explore: "Branchen entdecken", change: "Branche ändern", signup: "Konto erstellen", tools: "Gratis-Tools", media: "Wissen", partners: "Mit uns arbeiten", login: "Kunden-Login", checkup: "Gratis-Check" },
  hero: { kicker: "Der Technologiepartner für den europäischen Mittelstand", title: ["Sie brauchen keine KI.", "Sie brauchen, dass das Problem verschwindet."], lead: "Hören Sie auf, Software zu kaufen. Kaufen Sie Ergebnisse. Wir finden, richten ein und betreiben, was es für Ihre Branche am besten löst, und berichten jeden Monat die Ersparnis.", proof: ["Bezahlt wird für Ergebnisse", "Daten bleiben in der EU", "Kein Langzeitvertrag"] },
  ladder: { title: "Lösungsleiter", sub: "Kostenlos starten; den nächsten Schritt erst, wenn sich der letzte gelohnt hat.", cta: "Start", items: [
    { n: 1, title: "Gratis-Check", desc: "Wo Ihr Betrieb Zeit und Geld verliert und was zuerst hilft.", price: "Kostenlos", free: true },
    { n: 2, title: "Fertige Lösung", desc: "Eine bewährte Lösung für ein klares Problem, von uns betrieben.", price: "ab 190 €/Monat" },
    { n: 3, title: "Individuelle Umstellung", desc: "Werkzeuge verbunden mit CRM, Buchhaltung, Telefon und Lager.", price: "Projekt + monatlich" },
    { n: 4, title: "Technologiepartner", desc: "Wir finden, testen und führen neue Werkzeuge für Sie ein.", price: "ab 900 €/Monat" },
    { n: 5, title: "Firmen-Persona", desc: "Der eigene digitale Assistent Ihres Betriebs, der für Sie mit anderen Firmen arbeitet.", price: "monatlich" },
  ] },
  chat: { ...en.chat, title: "Fragen Sie unseren Berater", disclosure: "Sie sprechen mit einer KI. Antworten stammen aus unserem geprüften Katalog; Angebote prüft ein Mensch.", placeholder: "z. B. Wir verpassen Anrufe und Angebote dauern zwei Tage…", send: "Senden", examples: ["Wir verpassen Anrufe", "Angebote sind langsam", "Zu viel Papierkram"], hello: "Hallo! Ich bin der Berater von {brand}. Beschreiben Sie ein Problem und ich zeige Ihnen, was es löst – mit echten Zahlen.", live: "Passend zu Ihrem Bedarf", liveEmpty: "Während Sie schreiben, erscheinen hier passende Lösungen, Fallstudien und Tools.", book: "20-Minuten-Termin buchen", start: "Gratis-Check starten" },
  hubs: { title: "Ihre Branche", sub: "Ein Hub pro Branche: tägliche News, Lösungen, Firmenverzeichnis und ein kleines Fachnetzwerk. Ihr Land wählen Sie im Hub.", open: "Hub öffnen", soon: "Bald verfügbar", companies: "Unternehmen" },
  market: { title: "Lösungen für Ihre Branche", sub: "Kein Gemischtwarenladen: Branche wählen und nur sehen, was dafür funktioniert.", pick: "Branche wählen", from: "ab", per: "/Monat", view: "Details" },
  tools: { title: "Gratis-Tools", sub: "Ab Tag eins nützlich, ohne Anmeldung." },
  band: { title: "Sehen Sie, wo Ihr Betrieb Geld verliert", sub: "Kostenlos, kein Verkaufsgespräch, sofortiges Ergebnis.", cta: "Check starten" },
  newsletter: { title: "Wöchentlicher Branchen-Brief", sub: "News, Innovationen und Ausschreibungen. Double-Opt-in, jederzeit abbestellbar.", placeholder: "Geschäftliche E-Mail", cta: "Abonnieren", ok: "Bitte bestätigen Sie die E-Mail." },
  cookie: { text: "Cookies nur mit Ihrer Einwilligung: notwendige immer, Statistik zur Verbesserung. Kein Tracking vor Ihrer Wahl.", accept: "Alle akzeptieren", reject: "Nur notwendige", settings: "Einstellungen" },
  footer: { about: "Der Technologiepartner für den europäischen Mittelstand.", company: "Unternehmen", forAgents: "Für Agenten", legal: "Impressum & Datenschutz", referral: "Empfehlen Sie ein Unternehmen und erhalten Sie 10 % des ersten Jahres", rights: "Demoversion" },
  explore: { title: "Alle Branchen entdecken", sub: "Der vollständige Standardbaum (NACE): Abschnitt › Branche › Land. Wählen Sie Ihre, und die ganze Website passt sich an.", search: "Branche oder NACE-Code suchen", live: "Hub öffnen", soon: "Bald verfügbar", request: "Diese Branche anfragen", requested: "Danke, notiert. Wir öffnen Branchen nach Nachfrage.", none: "Nichts gefunden. Machen Sie den Check und nennen Sie Ihre Branche." },
  about: { title: "Über uns", vision: "Jedes Unternehmen verdient ein Technikteam von Weltklasse. Wir bauen es auf, für jede Branche, in jedem Land.", points: ["Wir sind kein Softwarehändler. Man misst uns an den Problemen, die wir beseitigen.", "Wir wählen für jede Aufgabe das beste Werkzeug, egal von wem, und betreiben es für Sie.", "Ein Spezialistenteam pro Branche: Sie müssen Ihr Handwerk nie von vorn erklären."] },
  personal: { welcome: "Willkommen zurück", yourHub: "Ihr Hub", all: "Alle Branchen anzeigen" },
};

const it: SiteCopy = {
  ...en,
  nav: { market: "Soluzioni", hubs: "Settori", myIndustry: "Il mio settore", explore: "Esplora settori", change: "Cambia settore", signup: "Crea account", tools: "Strumenti gratuiti", media: "Approfondimenti", partners: "Lavora con noi", login: "Area clienti", checkup: "Check-up gratuito" },
  hero: { kicker: "Il partner tecnologico delle PMI europee", title: ["Non vi serve l'IA.", "Vi serve che il problema sparisca."], lead: "Smettete di comprare software. Iniziate a comprare risultati. Troviamo, configuriamo e gestiamo ciò che lo risolve meglio nel vostro settore e ogni mese riportiamo i risparmi.", proof: ["Pagate i risultati", "Dati nell'UE", "Nessun contratto lungo"] },
  ladder: { title: "La scala delle soluzioni", sub: "Si parte gratis; il passo successivo solo quando il precedente ha reso.", cta: "Inizia", items: [
    { n: 1, title: "Check-up gratuito", desc: "Dove la tua azienda perde tempo e denaro, e cosa risolve prima.", price: "Gratis", free: true },
    { n: 2, title: "Soluzione pronta", desc: "Una soluzione collaudata per un problema chiaro, gestita da noi.", price: "da 190 €/mese" },
    { n: 3, title: "Trasformazione su misura", desc: "Strumenti collegati a CRM, contabilità, telefono e magazzino.", price: "progetto + mensile" },
    { n: 4, title: "Partner tecnologico", desc: "Cerchiamo, testiamo e introduciamo nuovi strumenti per voi.", price: "da 900 €/mese" },
    { n: 5, title: "Persona aziendale", desc: "L'assistente digitale della tua azienda che lavora con le altre aziende per te.", price: "mensile" },
  ] },
  chat: { ...en.chat, title: "Chiedi al nostro consulente", disclosure: "Stai parlando con un'IA. Le risposte vengono dal nostro catalogo approvato; le offerte sono verificate da una persona.", placeholder: "es. Perdiamo chiamate e i preventivi richiedono due giorni…", send: "Invia", examples: ["Perdiamo chiamate", "Preventivi lenti", "Troppa burocrazia"], hello: "Ciao! Sono il consulente di {brand}. Descrivi un problema e ti mostro cosa lo risolve, con numeri reali.", live: "In base alla tua esigenza", liveEmpty: "Mentre scrivi, qui compaiono soluzioni, casi e strumenti adatti.", book: "Prenota una call di 20 minuti", start: "Inizia il check-up" },
  hubs: { title: "Il tuo settore", sub: "Un hub per settore: notizie quotidiane, soluzioni, elenco aziende e una piccola rete professionale. Il paese si sceglie dentro l'hub.", open: "Apri hub", soon: "Presto", companies: "aziende" },
  market: { title: "Soluzioni per il tuo settore", sub: "Nessun negozio generico: scegli il settore e vedi solo ciò che funziona.", pick: "Scegli il settore", from: "da", per: "/mese", view: "Dettagli" },
  tools: { title: "Strumenti gratuiti", sub: "Utili dal primo giorno, senza registrazione." },
  band: { title: "Scopri dove la tua azienda perde denaro", sub: "Gratis, nessuna chiamata commerciale, risultato immediato.", cta: "Inizia il check-up" },
  newsletter: { title: "Brief settimanale del tuo settore", sub: "Notizie, innovazioni e gare. Doppio opt-in, disiscrizione in ogni momento.", placeholder: "Email di lavoro", cta: "Iscriviti", ok: "Conferma dalla tua email." },
  cookie: { text: "Cookie solo con il tuo consenso: necessari sempre, statistici per migliorare il sito. Nessun tracciamento prima della scelta.", accept: "Accetta tutti", reject: "Solo necessari", settings: "Impostazioni" },
  footer: { about: "Il partner tecnologico delle PMI europee.", company: "Azienda", forAgents: "Per agenti", legal: "Note legali e privacy", referral: "Segnala un'azienda e ricevi il 10% del primo anno", rights: "Versione demo" },
  explore: { title: "Esplora tutti i settori", sub: "L'albero standard completo (NACE): sezione › settore › paese. Scegli il tuo e tutto il sito si adatta.", search: "Cerca un settore o codice NACE", live: "Apri hub", soon: "Presto", request: "Richiedi questo settore", requested: "Grazie, registrato. Apriamo i settori in base alla domanda.", none: "Nessun risultato. Fai il check-up e dicci il tuo settore." },
  about: { title: "Chi siamo", vision: "Ogni azienda merita un team tecnico di livello mondiale. Lo stiamo costruendo, per ogni settore, in ogni paese.", points: ["Non vendiamo software. Ci misurano i problemi che eliminiamo.", "Scegliamo lo strumento migliore per ogni lavoro, chiunque lo produca, e lo gestiamo per voi.", "Un team specializzato per settore: non dovrete mai spiegare il vostro mestiere da zero."] },
  personal: { welcome: "Bentornato", yourHub: "Il tuo hub", all: "Vedi tutti i settori" },
};

const dictionaries: Record<string, SiteCopy> = { "en-gb": en, "de-de": de, "it-it": it, "fa-ir": fa };
export const copyFor = (locale: string): SiteCopy => dictionaries[locale] ?? en;
