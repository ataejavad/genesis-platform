/*
 * Email sending, provider-agnostic. Brevo (EU, free up to 300 emails a day) when BREVO_API_KEY and MAIL_FROM
 * are set; otherwise there is no mailer and approved emails wait in the outbox (the cockpit shows them).
 * Changing provider means one more branch here, nothing else.
 */

export type Mail = { to: string; subject: string; text: string; unsubscribeUrl?: string };
export type Mailer = { provider: string; send: (m: Mail) => Promise<string> };

export function mailerFromEnv(env = process.env): Mailer | null {
  const from = env.MAIL_FROM;
  if (env.BREVO_API_KEY && from) {
    const key = env.BREVO_API_KEY;
    const name = env.MAIL_FROM_NAME ?? env.SITE_NAME ?? "Legend Partner";
    return {
      provider: "brevo",
      async send(m) {
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            sender: { email: from, name },
            to: [{ email: m.to }],
            subject: m.subject,
            textContent: m.text,
            // one-click unsubscribe in the mail client (RFC 8058), next to the link in the text
            ...(m.unsubscribeUrl ? { headers: { "List-Unsubscribe": `<${m.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
          }),
          signal: AbortSignal.timeout(15_000),
        });
        const body = (await res.json().catch(() => ({}))) as { messageId?: string; message?: string };
        if (!res.ok) throw new Error(`brevo ${res.status}: ${body.message ?? "error"}`);
        return body.messageId ?? "sent";
      },
    };
  }
  return null;
}
