/*
 * Messages to customers, partners and leads, in their language (step 8 notification layer).
 * {placeholders} are filled by src/server/notify.ts. Short, plain, one action per message; outcomes, not technology.
 */

export type Template =
  | "invite"
  | "contract"
  | "code"
  | "invoice"
  | "reminder1"
  | "reminder2"
  | "reminder3"
  | "reminder4"
  | "issued"
  | "approval"
  | "approvalReminder"
  | "offer"
  | "accepted"
  | "changes"
  | "partnerContract"
  | "payout"
  | "leadConfirm";

type T = Record<Template, { subject: string; body: string }>;

const sign = "\n\n— {company}";

const it: T = {
  invite: { subject: "La vostra area {company} è pronta", body: "Buongiorno {name},\n\nla vostra area è pronta. Scegliete la password qui (valido 7 giorni):\n{link}" + sign },
  contract: { subject: "Contratto pronto da firmare: {title}", body: "Buongiorno {name},\n\nil contratto per «{title}» è pronto. Lo leggete e firmate qui con un codice che vi mandiamo per email:\n{link}\n\nDopo la firma vi inviamo la richiesta di anticipo ({deposit}) e partiamo." + sign },
  code: { subject: "Codice di firma: {code}", body: "Il vostro codice per {what} è {code}.\nVale 15 minuti. Se non l'avete chiesto voi, ignorate questa email." + sign },
  invoice: { subject: "Richiesta di pagamento {amount} – {title}", body: "Buongiorno {name},\n\n{title}: {amount} entro il {due}.\nBonifico a {holder}\nIBAN {iban}\nCausale: {reference}\n\nTrovate il QR per pagare dal telefono qui: {link}" + sign },
  reminder1: { subject: "Promemoria: {amount} in scadenza il {due}", body: "Buongiorno {name},\n\nvi ricordiamo il pagamento di {amount} ({title}) in scadenza il {due}. Causale: {reference}.\n{link}" + sign },
  reminder2: { subject: "Pagamento scaduto: {amount}", body: "Buongiorno {name},\n\nil pagamento di {amount} ({title}) è scaduto il {due}. Se avete già pagato, grazie e ignorate questo messaggio.\n{link}" + sign },
  reminder3: { subject: "Sollecito: {amount} scaduto da una settimana", body: "Buongiorno {name},\n\nil pagamento di {amount} ({title}) è scaduto da una settimana. Dal ritardo decorrono gli interessi del D.Lgs. 231/2002 e l'indennizzo di 40 €, come da contratto.\n{link}" + sign },
  reminder4: { subject: "Ultimo sollecito prima della sospensione: {amount}", body: "Buongiorno {name},\n\nil pagamento di {amount} ({title}) è scaduto da due settimane. Senza pagamento entro 3 giorni lavorativi sospenderemo il servizio, come previsto dal contratto. Rispondete pure a questa email se c'è un problema.\n{link}" + sign },
  issued: { subject: "Fattura {number}", body: "Buongiorno {name},\n\ngrazie per il pagamento. La fattura {number} di {amount} è nella vostra area e arriva anche tramite SdI.\n{link}" + sign },
  approval: { subject: "Da verificare: {title}", body: "Buongiorno {name},\n\n{title} è pronto. Verificatelo e confermate, oppure diteci cosa cambiare:\n{link}" + sign },
  approvalReminder: { subject: "Promemoria: {title} aspetta il vostro OK", body: "Buongiorno {name},\n\n{title} aspetta la vostra verifica da {hours} ore. Basta un clic:\n{link}" + sign },
  offer: { subject: "Nuovo lavoro per te: {title}", body: "Ciao {name},\n\nc'è un nuovo lavoro che fa per te: {title} ({pay}). Guardalo e accetta se ti va:\n{link}" + sign },
  accepted: { subject: "Lavoro accettato: {title}", body: "Ciao {name},\n\n«{title}» è stato accettato. Il pagamento è previsto entro il {due}.\n{link}" + sign },
  changes: { subject: "Modifiche richieste: {title}", body: "Ciao {name},\n\nper «{title}» servono alcune modifiche:\n{note}\n{link}" + sign },
  partnerContract: { subject: "Benvenuto in {company}: accordo da firmare", body: "Ciao {name},\n\nbenvenuto! Prima del primo lavoro firma l'accordo quadro (con riservatezza) qui:\n{link}\n\nScegli prima la tua password: {invite}" + sign },
  payout: { subject: "Pagamento inviato: {amount}", body: "Ciao {name},\n\nabbiamo inviato {amount} per «{title}».\n{link}" + sign },
  leadConfirm: { subject: "Confermate la vostra iscrizione", body: "Buongiorno,\n\nper ricevere {what}, confermate con un clic:\n{link}\n\nSe non siete stati voi, ignorate questa email." + sign },
};

const en: T = {
  invite: { subject: "Your {company} area is ready", body: "Hello {name},\n\nyour area is ready. Choose your password here (valid 7 days):\n{link}" + sign },
  contract: { subject: "Contract ready to sign: {title}", body: "Hello {name},\n\nthe contract for \"{title}\" is ready. Read and sign it here with a code we email you:\n{link}\n\nAfter signing we send the deposit request ({deposit}) and start." + sign },
  code: { subject: "Signing code: {code}", body: "Your code to {what} is {code}.\nIt is valid for 15 minutes. If you did not ask for it, ignore this email." + sign },
  invoice: { subject: "Payment request {amount} – {title}", body: "Hello {name},\n\n{title}: {amount} by {due}.\nTransfer to {holder}\nIBAN {iban}\nReference: {reference}\n\nScan the QR code to pay from your phone: {link}" + sign },
  reminder1: { subject: "Reminder: {amount} due on {due}", body: "Hello {name},\n\na reminder that {amount} ({title}) is due on {due}. Reference: {reference}.\n{link}" + sign },
  reminder2: { subject: "Payment overdue: {amount}", body: "Hello {name},\n\nthe payment of {amount} ({title}) was due on {due}. If you have already paid, thank you and please ignore this.\n{link}" + sign },
  reminder3: { subject: "Reminder: {amount} a week overdue", body: "Hello {name},\n\nthe payment of {amount} ({title}) is a week overdue. Late-payment interest and the €40 compensation apply as agreed.\n{link}" + sign },
  reminder4: { subject: "Final reminder before suspension: {amount}", body: "Hello {name},\n\nthe payment of {amount} ({title}) is two weeks overdue. Without payment within 3 working days we will suspend the service as the contract allows. Reply to this email if there is a problem.\n{link}" + sign },
  issued: { subject: "Invoice {number}", body: "Hello {name},\n\nthank you for your payment. Invoice {number} for {amount} is in your area.\n{link}" + sign },
  approval: { subject: "Ready for your check: {title}", body: "Hello {name},\n\n{title} is ready. Check it and accept, or tell us what to change:\n{link}" + sign },
  approvalReminder: { subject: "Reminder: {title} waits for your OK", body: "Hello {name},\n\n{title} has been waiting for your check for {hours} hours. One click is enough:\n{link}" + sign },
  offer: { subject: "New job for you: {title}", body: "Hi {name},\n\nthere is a new job that fits you: {title} ({pay}). Have a look and accept if you like:\n{link}" + sign },
  accepted: { subject: "Work accepted: {title}", body: "Hi {name},\n\n\"{title}\" was accepted. Payment is due by {due}.\n{link}" + sign },
  changes: { subject: "Changes requested: {title}", body: "Hi {name},\n\n\"{title}\" needs a few changes:\n{note}\n{link}" + sign },
  partnerContract: { subject: "Welcome to {company}: agreement to sign", body: "Hi {name},\n\nwelcome! Before your first job, sign the framework agreement (with NDA) here:\n{link}\n\nFirst choose your password: {invite}" + sign },
  payout: { subject: "Payment sent: {amount}", body: "Hi {name},\n\nwe sent {amount} for \"{title}\".\n{link}" + sign },
  leadConfirm: { subject: "Please confirm your subscription", body: "Hello,\n\nto receive {what}, confirm with one click:\n{link}\n\nIf this was not you, ignore this email." + sign },
};

const de: T = {
  invite: { subject: "Ihr {company}-Bereich ist bereit", body: "Guten Tag {name},\n\nIhr Bereich ist bereit. Wählen Sie hier Ihr Passwort (7 Tage gültig):\n{link}" + sign },
  contract: { subject: "Vertrag zur Unterschrift: {title}", body: "Guten Tag {name},\n\nder Vertrag für „{title}“ ist bereit. Lesen und unterschreiben Sie ihn hier mit einem Code per E-Mail:\n{link}\n\nNach der Unterschrift senden wir die Anzahlungsanforderung ({deposit}) und starten." + sign },
  code: { subject: "Signaturcode: {code}", body: "Ihr Code für {what} lautet {code}.\nEr gilt 15 Minuten. Falls Sie ihn nicht angefordert haben, ignorieren Sie diese E-Mail." + sign },
  invoice: { subject: "Zahlungsaufforderung {amount} – {title}", body: "Guten Tag {name},\n\n{title}: {amount} bis {due}.\nÜberweisung an {holder}\nIBAN {iban}\nVerwendungszweck: {reference}\n\nQR-Code zum Bezahlen per Handy: {link}" + sign },
  reminder1: { subject: "Erinnerung: {amount} fällig am {due}", body: "Guten Tag {name},\n\nzur Erinnerung: {amount} ({title}) ist am {due} fällig. Verwendungszweck: {reference}.\n{link}" + sign },
  reminder2: { subject: "Zahlung überfällig: {amount}", body: "Guten Tag {name},\n\ndie Zahlung von {amount} ({title}) war am {due} fällig. Falls schon bezahlt: danke, bitte ignorieren.\n{link}" + sign },
  reminder3: { subject: "Mahnung: {amount} seit einer Woche überfällig", body: "Guten Tag {name},\n\ndie Zahlung von {amount} ({title}) ist seit einer Woche überfällig. Verzugszinsen und die Pauschale von 40 € gelten wie vereinbart.\n{link}" + sign },
  reminder4: { subject: "Letzte Mahnung vor Aussetzung: {amount}", body: "Guten Tag {name},\n\ndie Zahlung von {amount} ({title}) ist seit zwei Wochen überfällig. Ohne Zahlung binnen 3 Arbeitstagen setzen wir den Service vertragsgemäß aus. Antworten Sie gern, falls es ein Problem gibt.\n{link}" + sign },
  issued: { subject: "Rechnung {number}", body: "Guten Tag {name},\n\ndanke für Ihre Zahlung. Rechnung {number} über {amount} liegt in Ihrem Bereich.\n{link}" + sign },
  approval: { subject: "Zur Prüfung: {title}", body: "Guten Tag {name},\n\n{title} ist fertig. Prüfen und abnehmen, oder sagen Sie uns, was zu ändern ist:\n{link}" + sign },
  approvalReminder: { subject: "Erinnerung: {title} wartet auf Ihr OK", body: "Guten Tag {name},\n\n{title} wartet seit {hours} Stunden auf Ihre Prüfung. Ein Klick genügt:\n{link}" + sign },
  offer: { subject: "Neuer Auftrag für Sie: {title}", body: "Hallo {name},\n\nes gibt einen passenden Auftrag: {title} ({pay}). Ansehen und annehmen, wenn Sie möchten:\n{link}" + sign },
  accepted: { subject: "Arbeit abgenommen: {title}", body: "Hallo {name},\n\n„{title}“ wurde abgenommen. Zahlung bis {due}.\n{link}" + sign },
  changes: { subject: "Änderungen gewünscht: {title}", body: "Hallo {name},\n\nfür „{title}“ braucht es Änderungen:\n{note}\n{link}" + sign },
  partnerContract: { subject: "Willkommen bei {company}: Vertrag zur Unterschrift", body: "Hallo {name},\n\nwillkommen! Vor dem ersten Auftrag unterschreiben Sie hier den Rahmenvertrag (mit Geheimhaltung):\n{link}\n\nWählen Sie zuerst Ihr Passwort: {invite}" + sign },
  payout: { subject: "Zahlung gesendet: {amount}", body: "Hallo {name},\n\nwir haben {amount} für „{title}“ überwiesen.\n{link}" + sign },
  leadConfirm: { subject: "Bitte bestätigen Sie Ihre Anmeldung", body: "Guten Tag,\n\num {what} zu erhalten, bestätigen Sie mit einem Klick:\n{link}\n\nFalls Sie das nicht waren, ignorieren Sie diese E-Mail." + sign },
};

const fa: T = {
  invite: { subject: "فضای شما در {company} آماده است", body: "سلام {name}،\n\nفضای شما آماده است. رمز عبورتان را اینجا انتخاب کنید (۷ روز اعتبار):\n{link}" + sign },
  contract: { subject: "قرارداد آماده امضا: {title}", body: "سلام {name}،\n\nقرارداد «{title}» آماده است. اینجا بخوانید و با کدی که ایمیل می‌کنیم امضا کنید:\n{link}\n\nبعد از امضا درخواست پیش‌پرداخت ({deposit}) را می‌فرستیم و شروع می‌کنیم." + sign },
  code: { subject: "کد امضا: {code}", body: "کد شما برای {what}: {code}\n۱۵ دقیقه اعتبار دارد. اگر شما درخواست نکرده‌اید، این ایمیل را نادیده بگیرید." + sign },
  invoice: { subject: "درخواست پرداخت {amount} – {title}", body: "سلام {name}،\n\n{title}: {amount} تا {due}.\nواریز به {holder}\nIBAN {iban}\nشرح واریز: {reference}\n\nبا QR از گوشی پرداخت کنید: {link}" + sign },
  reminder1: { subject: "یادآوری: {amount} سررسید {due}", body: "سلام {name}،\n\nیادآوری پرداخت {amount} ({title}) با سررسید {due}. شرح واریز: {reference}.\n{link}" + sign },
  reminder2: { subject: "پرداخت دیر شده: {amount}", body: "سلام {name}،\n\nسررسید پرداخت {amount} ({title}) {due} بود. اگر پرداخت کرده‌اید، ممنون و این پیام را نادیده بگیرید.\n{link}" + sign },
  reminder3: { subject: "پیگیری: {amount} یک هفته دیر شده", body: "سلام {name}،\n\nپرداخت {amount} ({title}) یک هفته دیر شده است. طبق قرارداد بهره دیرکرد و ۴۰ یورو هزینه وصول اضافه می‌شود.\n{link}" + sign },
  reminder4: { subject: "آخرین یادآوری پیش از توقف سرویس: {amount}", body: "سلام {name}،\n\nپرداخت {amount} ({title}) دو هفته دیر شده است. اگر تا ۳ روز کاری پرداخت نشود، طبق قرارداد سرویس متوقف می‌شود. اگر مشکلی هست جواب همین ایمیل را بدهید.\n{link}" + sign },
  issued: { subject: "فاکتور {number}", body: "سلام {name}،\n\nممنون از پرداخت شما. فاکتور {number} به مبلغ {amount} در فضای شماست.\n{link}" + sign },
  approval: { subject: "آماده بررسی: {title}", body: "سلام {name}،\n\n{title} آماده است. بررسی و تأیید کنید، یا بگویید چه چیزی تغییر کند:\n{link}" + sign },
  approvalReminder: { subject: "یادآوری: {title} منتظر تأیید شماست", body: "سلام {name}،\n\n{title} {hours} ساعت است منتظر بررسی شماست. یک کلیک کافی است:\n{link}" + sign },
  offer: { subject: "کار تازه برای شما: {title}", body: "سلام {name}،\n\nیک کار مناسب شما هست: {title} ({pay}). ببینید و اگر خواستید قبول کنید:\n{link}" + sign },
  accepted: { subject: "کار قبول شد: {title}", body: "سلام {name}،\n\n«{title}» قبول شد. پرداخت تا {due}.\n{link}" + sign },
  changes: { subject: "اصلاح لازم است: {title}", body: "سلام {name}،\n\n«{title}» چند اصلاح لازم دارد:\n{note}\n{link}" + sign },
  partnerContract: { subject: "به {company} خوش آمدید: قرارداد برای امضا", body: "سلام {name}،\n\nخوش آمدید! پیش از اولین کار، قرارداد چارچوب (با محرمانگی) را اینجا امضا کنید:\n{link}\n\nاول رمز عبورتان را انتخاب کنید: {invite}" + sign },
  payout: { subject: "پرداخت شد: {amount}", body: "سلام {name}،\n\n{amount} برای «{title}» واریز شد.\n{link}" + sign },
  leadConfirm: { subject: "لطفاً عضویت را تأیید کنید", body: "سلام،\n\nبرای دریافت {what}، با یک کلیک تأیید کنید:\n{link}\n\nاگر شما نبودید، این ایمیل را نادیده بگیرید." + sign },
};

const ALL: Record<string, T> = { it, en, de, fa };

export const CODE_WHAT: Record<string, { sign: string; clauses: string }> = {
  it: { sign: "firmare il contratto", clauses: "approvare le clausole specifiche" },
  en: { sign: "sign the contract", clauses: "approve the specific clauses" },
  de: { sign: "den Vertrag zu unterschreiben", clauses: "die besonderen Klauseln zu bestätigen" },
  fa: { sign: "امضای قرارداد", clauses: "تأیید بندهای ویژه" },
};

export function render(template: Template, lang: string, vars: Record<string, string | number | null | undefined>) {
  const t = (ALL[lang.slice(0, 2)] ?? en)[template];
  const fill = (s: string) => s.replace(/\{(\w+)\}/g, (_, k: string) => (vars[k] === undefined || vars[k] === null ? "" : String(vars[k])));
  return { subject: fill(t.subject), body: fill(t.body) };
}
