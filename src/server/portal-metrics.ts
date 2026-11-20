/**
 * The results a customer sees (doc 15 §6و, Javad 2026-10-23: we sell results, never tools or usage). Every
 * metric says what was achieved and how its € value is counted, so the number on the dashboard can be checked.
 * Agents and the team write outcomes with one of these ids; anything else is refused.
 */

type L = Record<"en" | "it" | "de" | "fa", string>;
export type Metric = { id: string; unit: "count" | "hours" | "eur"; label: L; how: L };

export const METRICS: Metric[] = [
  {
    id: "calls_answered",
    unit: "count",
    label: { en: "Calls answered that would have been missed", it: "Chiamate risposte che sarebbero andate perse", de: "Anrufe angenommen, die sonst verloren wären", fa: "تماس‌هایی که بی‌جواب می‌ماند و جواب داده شد" },
    how: { en: "€ = calls × share that becomes a job × average job margin (from your check-up)", it: "€ = chiamate × quota che diventa lavoro × margine medio (dal vostro check-up)", de: "€ = Anrufe × Anteil, der zum Auftrag wird × durchschnittliche Marge (aus Ihrem Check-up)", fa: "یورو = تعداد تماس × سهمی که کار می‌شود × سود متوسط هر کار (از چک‌آپ شما)" },
  },
  {
    id: "quotes_sent",
    unit: "count",
    label: { en: "Quotes sent within the hour", it: "Preventivi inviati entro un'ora", de: "Angebote innerhalb einer Stunde verschickt", fa: "پیش‌فاکتورهایی که در کمتر از یک ساعت رفت" },
    how: { en: "€ = extra quotes won compared with your starting win rate × average margin", it: "€ = preventivi vinti in più rispetto al tasso di partenza × margine medio", de: "€ = zusätzlich gewonnene Angebote gegenüber Ihrer Ausgangsquote × Marge", fa: "یورو = پیش‌فاکتورهای برنده‌شده‌ی اضافه نسبت به نرخ شروع × سود متوسط" },
  },
  {
    id: "jobs_won",
    unit: "count",
    label: { en: "Jobs won through our follow-up", it: "Lavori vinti grazie al nostro follow-up", de: "Aufträge durch unser Nachfassen gewonnen", fa: "کارهایی که با پیگیری ما برنده شدید" },
    how: { en: "€ = margin of each job you confirmed", it: "€ = margine di ogni lavoro confermato da voi", de: "€ = Marge jedes von Ihnen bestätigten Auftrags", fa: "یورو = سود هر کاری که خودتان تأیید کردید" },
  },
  {
    id: "hours_saved",
    unit: "hours",
    label: { en: "Office hours taken off your hands", it: "Ore d'ufficio tolte dalle vostre mani", de: "Bürostunden, die Sie nicht mehr selbst machen", fa: "ساعت‌های کار دفتری که از دوش شما برداشتیم" },
    how: { en: "€ = hours × the hourly cost you gave us", it: "€ = ore × il costo orario che ci avete indicato", de: "€ = Stunden × Ihr angegebener Stundensatz", fa: "یورو = ساعت × هزینه‌ی ساعتی که خودتان گفتید" },
  },
  {
    id: "invoiced_faster",
    unit: "eur",
    label: { en: "Invoices sent the same day", it: "Fatture emesse in giornata", de: "Rechnungen am selben Tag verschickt", fa: "فاکتورهایی که همان روز رفت" },
    how: { en: "€ = invoice amount × days gained × your cost of money", it: "€ = importo × giorni guadagnati × costo del denaro", de: "€ = Rechnungsbetrag × gewonnene Tage × Ihre Kapitalkosten", fa: "یورو = مبلغ فاکتور × روزهای جلوافتاده × هزینه‌ی پول" },
  },
  {
    id: "files_done",
    unit: "count",
    label: { en: "Incentive files completed and checked", it: "Pratiche incentivi completate e verificate", de: "Förderanträge fertig und geprüft", fa: "پرونده‌های مشوق که کامل و بررسی شد" },
    how: { en: "€ = incentive amount your customer received", it: "€ = incentivo ricevuto dal vostro cliente", de: "€ = Fördersumme, die Ihr Kunde erhielt", fa: "یورو = مبلغ مشوقی که مشتری شما گرفت" },
  },
];

export const metric = (id: string) => METRICS.find((m) => m.id === id);
export const metricLabel = (id: string, lang: string) => {
  const m = metric(id);
  return m ? (m.label[lang as keyof L] ?? m.label.en) : id;
};
export const metricHow = (id: string, lang: string) => {
  const m = metric(id);
  return m ? (m.how[lang as keyof L] ?? m.how.en) : "";
};
