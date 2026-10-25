import { getDb } from "@/db";
import { optOut } from "@/server/outreach";

const page = (text: string) =>
  new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>OK</title><body style="font:16px system-ui;max-width:32rem;margin:15vh auto;padding:0 16px">${text}</body>`, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });

// Link at the end of every email (and the mail client's one-click unsubscribe): stops all contact at once.
async function handle(req: Request) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  try {
    await optOut(getDb(), token);
    return page("✓ Fatto: non riceverà più messaggi da noi. / Done: you will not hear from us again.");
  } catch {
    return page("Link non valido. Scriva a privacy@ e la togliamo subito. / Invalid link.");
  }
}
export const GET = handle;
export const POST = handle;
