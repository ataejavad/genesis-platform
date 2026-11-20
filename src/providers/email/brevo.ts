import type { Env } from "../registry";
import type { Mailer } from ".";

/** Brevo (EU, free up to 300 emails a day): BREVO_API_KEY, MAIL_FROM, optional MAIL_FROM_NAME. */
export function brevoMailer(env: Env = process.env, fetchImpl: typeof fetch = fetch): Mailer {
  const key = env.BREVO_API_KEY!;
  const from = env.MAIL_FROM!;
  const name = env.MAIL_FROM_NAME ?? env.SITE_NAME ?? "Legend Partner";
  return {
    provider: "brevo",
    async send(m) {
      const res = await fetchImpl("https://api.brevo.com/v3/smtp/email", {
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
