import { getDb } from "@/db";
import { confirmLead } from "@/server/notify";

// Public: the link in the confirmation email (double opt-in). Confirmed leads go to the CRM (worker, lead.confirmed).
const TEXT: Record<string, [string, string]> = {
  it: ["Iscrizione confermata", "Grazie: da ora riceverai i nostri avvisi. Puoi cancellarti in ogni momento con il link in fondo a ogni email."],
  de: ["Anmeldung bestätigt", "Danke: Sie erhalten ab jetzt unsere Hinweise. Abmelden geht jederzeit über den Link in jeder E-Mail."],
  en: ["Subscription confirmed", "Thank you: you will now get our alerts. You can unsubscribe at any time with the link in every email."],
  fa: ["عضویت تأیید شد", "سپاس: از این پس هشدارهای ما را دریافت می‌کنید. با پیوند پایین هر ایمیل هر وقت خواستید لغو کنید."],
};
const BAD: Record<string, string> = { it: "Link non valido.", de: "Ungültiger Link.", en: "Invalid link.", fa: "پیوند نامعتبر است." };

const page = (lang: string, title: string, body: string, status = 200) =>
  new Response(`<!doctype html><html lang="${lang}" dir="${lang === "fa" ? "rtl" : "ltr"}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><body style="font-family:system-ui,sans-serif;max-width:520px;margin:15vh auto;padding:16px;line-height:1.5"><h1>${title}</h1><p>${body}</p><p><a href="/">←</a></p></body></html>`, { status, headers: { "content-type": "text/html; charset=utf-8" } });

export async function GET(req: Request) {
  const u = new URL(req.url);
  try {
    const lead = await confirmLead(getDb(), u.searchParams.get("id") ?? "", u.searchParams.get("t") ?? "");
    const lang = (lead?.locale ?? "en").slice(0, 2);
    const [title, body] = TEXT[lang] ?? TEXT.en;
    return page(lang, title, body);
  } catch {
    return page("en", BAD.en, `${BAD.it} · ${BAD.de}`, 400);
  }
}
