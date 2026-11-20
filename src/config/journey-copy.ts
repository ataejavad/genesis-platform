// Customer journey texts added from the marketplace lessons (2026-10-25): brief card, payment per step, deemed
// acceptance, rating, complaint path. One dictionary per portal language; results words, never tools.

const en = {
  briefReady: "Here is what I understood. Check it and confirm with one press; the contract follows within 24 hours.",
  briefQuote: "Here is what I understood. Confirm it and you get a fixed price within 24 hours.",
  complaintAsk: {
    fix: "I'm sorry. Here is how we make it right: first the same specialist fixes it at no cost. Shall I start that?",
    swap: "I'm sorry the fix did not solve it. Next step: someone new redoes it, at our cost. Shall I start that?",
    founder: "I'm sorry. Our founder looks at it personally and contacts you within one working day. Shall I pass it on?",
    support: "I'm sorry. Shall I send this to the team? They answer within one working day.",
  } as Record<string, string>,
  complaintDone: {
    fix: "Started: the fix is free and ready by {d}. You'll check it here before it counts as done.",
    swap: "Started: someone new redoes it at our cost, ready by {d}.",
    founder: "Passed to our founder. You hear from us by {d}.",
    support: "Sent. The team answers by {d}.",
  } as Record<string, string>,
  brief: {
    title: "Your brief", problem: "What costs you time or money", result: "Result", steps: "Steps", days: "Ready in about {n} days",
    included: "{n} rounds of changes per step included", excluded: "Anything outside these steps is priced before any work starts",
    price: "{setup} once, then {monthly} per month", pay: "Each step is paid before it starts", custom: "A solution we design for you, fixed price",
    quoteBy: "Fixed price by {d}", confirm: "Confirm", cancel: "Not now",
    ordered: "Confirmed. The contract comes within 24 hours.", requested: "Confirmed. You get the price by {d}.",
  },
  complaint: { title: "If you are not satisfied", ladder: ["We fix it free (3 days)", "Someone new redoes it, at our cost (7 days)", "Our founder takes over (1 working day)"], go: { fix: "Fix it", swap: "Have someone new redo it", founder: "Pass to the founder", support: "Send to the team" } as Record<string, string> },
  approval: { autoOn: "Counts as accepted on {d} if we hear nothing", rate: "How happy are you with this step?", note: "One sentence (optional)", stars: "{n} of 5" },
  ms: { planned: "Starts after the previous step", unpaid: "Starts when paid" } as Record<string, string>,
  cancelAsk: "I'm sorry to hear that. You can cancel with 30 days' notice: the service runs until {d}, then stops. Before you go, what is the main reason? If it is something we can fix, we fix it first.",
  cancelNone: "You have no running monthly service to cancel.",
  cancelGiven: "Your notice is in: the service ends on {d}. Changed your mind? Just tell me.",
  cancel: { title: "Cancel the monthly service", reasons: { price: "Too expensive", timing: "Not the right time", fit: "Not what we need", competitor: "We chose someone else", quality: "Quality not good enough", other: "Other" } as Record<string, string>, note: "Anything we should know (optional)", confirm: "Give notice", keep: "Keep it", kept: "Good, everything stays as it is.", done: "Notice received. The service runs until {d}, then stops with no further charges." },
  priceBy: "Price by {d}",
  due: "due {d}",
};

export type JourneyCopy = typeof en;

const it: JourneyCopy = {
  briefReady: "Ecco cosa ho capito. Controllate e confermate con un clic; il contratto arriva entro 24 ore.",
  briefQuote: "Ecco cosa ho capito. Confermate e ricevete un prezzo fisso entro 24 ore.",
  complaintAsk: {
    fix: "Mi dispiace. Ecco come rimediamo: prima lo stesso specialista lo corregge senza costi. Avvio?",
    swap: "Mi dispiace che la correzione non sia bastata. Prossimo passo: una persona nuova lo rifà, a nostre spese. Avvio?",
    founder: "Mi dispiace. Il nostro fondatore se ne occupa personalmente e vi contatta entro un giorno lavorativo. Lo passo a lui?",
    support: "Mi dispiace. Lo invio al team? Rispondono entro un giorno lavorativo.",
  },
  complaintDone: {
    fix: "Avviato: la correzione è gratuita e pronta entro il {d}. La verificate qui prima che conti come fatta.",
    swap: "Avviato: una persona nuova lo rifà a nostre spese, pronto entro il {d}.",
    founder: "Passato al nostro fondatore. Vi rispondiamo entro il {d}.",
    support: "Inviato. Il team risponde entro il {d}.",
  },
  brief: {
    title: "Il vostro brief", problem: "Cosa vi fa perdere tempo o soldi", result: "Risultato", steps: "Fasi", days: "Pronto in circa {n} giorni",
    included: "{n} giri di modifiche inclusi per fase", excluded: "Tutto ciò che esce da queste fasi si quota prima di iniziare",
    price: "{setup} una tantum, poi {monthly} al mese", pay: "Ogni fase si paga prima che inizi", custom: "Una soluzione progettata per voi, a prezzo fisso",
    quoteBy: "Prezzo fisso entro il {d}", confirm: "Confermo", cancel: "Non ora",
    ordered: "Confermato. Il contratto arriva entro 24 ore.", requested: "Confermato. Ricevete il prezzo entro il {d}.",
  },
  complaint: { title: "Se non siete soddisfatti", ladder: ["Lo correggiamo gratis (3 giorni)", "Una persona nuova lo rifà, a nostre spese (7 giorni)", "Se ne occupa il nostro fondatore (1 giorno lavorativo)"], go: { fix: "Correggete", swap: "Fatelo rifare da un altro", founder: "Passate al fondatore", support: "Invia al team" } },
  approval: { autoOn: "Vale come accettata il {d} se non riceviamo risposta", rate: "Quanto siete soddisfatti di questa fase?", note: "Una frase (facoltativa)", stars: "{n} su 5" },
  ms: { planned: "Parte dopo la fase precedente", unpaid: "Parte al pagamento" },
  cancelAsk: "Mi dispiace. Potete disdire con 30 giorni di preavviso: il servizio continua fino al {d}, poi si ferma. Prima di andare: qual è il motivo principale? Se è qualcosa che possiamo sistemare, lo sistemiamo prima.",
  cancelNone: "Non avete servizi mensili attivi da disdire.",
  cancelGiven: "La disdetta è registrata: il servizio finisce il {d}. Avete cambiato idea? Ditemelo.",
  cancel: { title: "Disdire il servizio mensile", reasons: { price: "Troppo caro", timing: "Non è il momento", fit: "Non è quello che ci serve", competitor: "Abbiamo scelto un altro", quality: "Qualità non sufficiente", other: "Altro" }, note: "Qualcosa che dovremmo sapere (facoltativo)", confirm: "Disdico", keep: "Lo tengo", kept: "Bene, resta tutto com'è.", done: "Disdetta ricevuta. Il servizio continua fino al {d}, poi si ferma senza altri addebiti." },
  priceBy: "Prezzo entro il {d}",
  due: "entro il {d}",
};

const de: JourneyCopy = {
  briefReady: "So habe ich es verstanden. Prüfen und mit einem Klick bestätigen; der Vertrag folgt binnen 24 Stunden.",
  briefQuote: "So habe ich es verstanden. Bestätigen Sie, und Sie erhalten binnen 24 Stunden einen Festpreis.",
  complaintAsk: {
    fix: "Das tut mir leid. So machen wir es gut: zuerst bessert derselbe Spezialist kostenlos nach. Soll ich das starten?",
    swap: "Schade, dass die Nachbesserung nicht gereicht hat. Nächster Schritt: jemand Neues macht es noch einmal, auf unsere Kosten. Starten?",
    founder: "Das tut mir leid. Unser Gründer kümmert sich persönlich und meldet sich binnen eines Arbeitstags. Soll ich es weitergeben?",
    support: "Das tut mir leid. Soll ich es an das Team senden? Antwort binnen eines Arbeitstags.",
  },
  complaintDone: {
    fix: "Gestartet: die Nachbesserung ist kostenlos und bis {d} fertig. Sie prüfen sie hier, bevor sie als erledigt gilt.",
    swap: "Gestartet: jemand Neues macht es auf unsere Kosten, fertig bis {d}.",
    founder: "An unseren Gründer weitergegeben. Sie hören bis {d} von uns.",
    support: "Gesendet. Das Team antwortet bis {d}.",
  },
  brief: {
    title: "Ihr Briefing", problem: "Was Sie Zeit oder Geld kostet", result: "Ergebnis", steps: "Phasen", days: "Fertig in etwa {n} Tagen",
    included: "{n} Änderungsrunden pro Phase inklusive", excluded: "Alles außerhalb dieser Phasen wird vor Beginn angeboten",
    price: "{setup} einmalig, dann {monthly} pro Monat", pay: "Jede Phase wird vor ihrem Beginn bezahlt", custom: "Eine für Sie entworfene Lösung zum Festpreis",
    quoteBy: "Festpreis bis {d}", confirm: "Bestätigen", cancel: "Nicht jetzt",
    ordered: "Bestätigt. Der Vertrag kommt binnen 24 Stunden.", requested: "Bestätigt. Sie erhalten den Preis bis {d}.",
  },
  complaint: { title: "Wenn Sie nicht zufrieden sind", ladder: ["Wir bessern kostenlos nach (3 Tage)", "Jemand Neues macht es noch einmal, auf unsere Kosten (7 Tage)", "Unser Gründer übernimmt (1 Arbeitstag)"], go: { fix: "Nachbessern", swap: "Von jemand Neuem machen lassen", founder: "An den Gründer", support: "An das Team senden" } },
  approval: { autoOn: "Gilt am {d} als abgenommen, wenn wir nichts hören", rate: "Wie zufrieden sind Sie mit dieser Phase?", note: "Ein Satz (optional)", stars: "{n} von 5" },
  ms: { planned: "Startet nach der vorherigen Phase", unpaid: "Startet nach Zahlung" },
  cancelAsk: "Das tut mir leid. Sie können mit 30 Tagen Frist kündigen: Der Service läuft bis {d} und endet dann. Bevor Sie gehen: Was ist der Hauptgrund? Wenn wir es beheben können, tun wir das zuerst.",
  cancelNone: "Sie haben keinen laufenden Monatsservice zum Kündigen.",
  cancelGiven: "Ihre Kündigung ist eingegangen: Der Service endet am {d}. Doch anders entschieden? Sagen Sie es mir.",
  cancel: { title: "Monatsservice kündigen", reasons: { price: "Zu teuer", timing: "Nicht der richtige Zeitpunkt", fit: "Nicht das, was wir brauchen", competitor: "Wir haben jemand anderen gewählt", quality: "Qualität nicht gut genug", other: "Anderes" }, note: "Was wir wissen sollten (optional)", confirm: "Kündigen", keep: "Behalten", kept: "Gut, alles bleibt wie es ist.", done: "Kündigung erhalten. Der Service läuft bis {d} und endet dann ohne weitere Kosten." },
  priceBy: "Preis bis {d}",
  due: "bis {d}",
};

const fa: JourneyCopy = {
  briefReady: "این چیزی است که فهمیدم. بررسی کنید و با یک کلیک تأیید کنید؛ قرارداد ظرف ۲۴ ساعت می‌رسد.",
  briefQuote: "این چیزی است که فهمیدم. تأیید کنید تا ظرف ۲۴ ساعت قیمت ثابت برایتان بفرستیم.",
  complaintAsk: {
    fix: "متأسفم. این‌طور درستش می‌کنیم: اول همان متخصص رایگان اصلاحش می‌کند. شروع کنم؟",
    swap: "متأسفم که اصلاح کافی نبود. قدم بعد: یک نفر تازه از نو انجامش می‌دهد، با هزینه ما. شروع کنم؟",
    founder: "متأسفم. بنیان‌گذار ما شخصاً پیگیری می‌کند و ظرف یک روز کاری با شما تماس می‌گیرد. به او بسپارم؟",
    support: "متأسفم. برای تیم بفرستم؟ ظرف یک روز کاری جواب می‌دهند.",
  },
  complaintDone: {
    fix: "شروع شد: اصلاح رایگان است و تا {d} آماده می‌شود. قبل از اینکه تمام‌شده حساب شود، همین‌جا بررسی‌اش می‌کنید.",
    swap: "شروع شد: یک نفر تازه با هزینه ما از نو انجامش می‌دهد، تا {d}.",
    founder: "به بنیان‌گذار ما سپرده شد. تا {d} از ما خبر می‌گیرید.",
    support: "فرستاده شد. تیم تا {d} جواب می‌دهد.",
  },
  brief: {
    title: "خلاصه کار شما", problem: "چه چیزی وقت یا پول شما را می‌گیرد", result: "نتیجه", steps: "مرحله‌ها", days: "آماده در حدود {n} روز",
    included: "{n} دور اصلاح در هر مرحله رایگان", excluded: "هر چیزی بیرون از این مرحله‌ها پیش از شروع قیمت داده می‌شود",
    price: "{setup} یک‌بار، بعد {monthly} در ماه", pay: "هر مرحله پیش از شروعش پرداخت می‌شود", custom: "راه‌حلی که برای شما طراحی می‌کنیم، با قیمت ثابت",
    quoteBy: "قیمت ثابت تا {d}", confirm: "تأیید", cancel: "فعلاً نه",
    ordered: "تأیید شد. قرارداد ظرف ۲۴ ساعت می‌رسد.", requested: "تأیید شد. قیمت را تا {d} می‌گیرید.",
  },
  complaint: { title: "اگر راضی نیستید", ladder: ["رایگان اصلاحش می‌کنیم (۳ روز)", "یک نفر تازه از نو انجامش می‌دهد، با هزینه ما (۷ روز)", "بنیان‌گذار ما خودش پیگیری می‌کند (۱ روز کاری)"], go: { fix: "اصلاح کنید", swap: "یک نفر دیگر انجام دهد", founder: "به بنیان‌گذار بسپار", support: "برای تیم بفرست" } },
  approval: { autoOn: "اگر جوابی نرسد، {d} تأییدشده حساب می‌شود", rate: "از این مرحله چقدر راضی هستید؟", note: "یک جمله (اختیاری)", stars: "{n} از ۵" },
  ms: { planned: "بعد از مرحله قبل شروع می‌شود", unpaid: "بعد از پرداخت شروع می‌شود" },
  cancelAsk: "متأسفم. می‌توانید با ۳۰ روز اطلاع قبلی لغو کنید: سرویس تا {d} ادامه دارد و بعد متوقف می‌شود. قبل از رفتن، دلیل اصلی چیست؟ اگر چیزی است که می‌توانیم درستش کنیم، اول آن را درست می‌کنیم.",
  cancelNone: "سرویس ماهانه فعالی برای لغو ندارید.",
  cancelGiven: "درخواست لغو ثبت شده: سرویس در {d} تمام می‌شود. نظرتان عوض شد؟ فقط بگویید.",
  cancel: { title: "لغو سرویس ماهانه", reasons: { price: "خیلی گران است", timing: "الان وقتش نیست", fit: "چیزی که لازم داریم نیست", competitor: "کس دیگری را انتخاب کردیم", quality: "کیفیت کافی نیست", other: "دیگر" }, note: "چیزی که باید بدانیم (اختیاری)", confirm: "لغو می‌کنم", keep: "نگهش می‌دارم", kept: "خوب، همه چیز همان‌طور می‌ماند.", done: "لغو دریافت شد. سرویس تا {d} ادامه دارد و بعد بدون هزینه دیگری متوقف می‌شود." },
  priceBy: "قیمت تا {d}",
  due: "تا {d}",
};

const COPY: Record<string, JourneyCopy> = { en, it, de, fa };
export const journeyCopy = (lang: string) => COPY[lang] ?? en;
