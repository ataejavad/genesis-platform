import { getDb } from "@/db";
import { unsubscribeLeadLink } from "@/server/notify";

// Public: the unsubscribe link in every marketing email to a lead (GET) and the mail client's one-click button (POST).
const TEXT: Record<string, [string, string]> = {
  it: ["Cancellazione fatta", "Non riceverai più promemoria né offerte da noi."],
  de: ["Abgemeldet", "Sie erhalten keine Erinnerungen und Angebote mehr von uns."],
  en: ["Unsubscribed", "You will not get reminders or offers from us any more."],
  fa: ["لغو شد", "دیگر یادآوری یا پیشنهادی از ما دریافت نمی‌کنید."],
};

const page = (lang: string, title: string, body: string, status = 200) =>
  new Response(`<!doctype html><html lang="${lang}" dir="${lang === "fa" ? "rtl" : "ltr"}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><body style="font-family:system-ui,sans-serif;max-width:520px;margin:15vh auto;padding:16px;line-height:1.5"><h1>${title}</h1><p>${body}</p><p><a href="/">←</a></p></body></html>`, { status, headers: { "content-type": "text/html; charset=utf-8" } });

async function handle(req: Request) {
  const u = new URL(req.url);
  try {
    const lead = await unsubscribeLeadLink(getDb(), u.searchParams.get("id") ?? "", u.searchParams.get("t") ?? "");
    const lang = (lead?.locale ?? "en").slice(0, 2);
    const [title, body] = TEXT[lang] ?? TEXT.en;
    return page(lang, title, body);
  } catch {
    return page("en", "Invalid link", "Link non valido · Ungültiger Link", 400);
  }
}
export const GET = handle;
export const POST = handle;
