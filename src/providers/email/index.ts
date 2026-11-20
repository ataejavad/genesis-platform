import type { Env } from "../registry";
import { chosen } from "../registry";
import { brevoMailer } from "./brevo";

/*
 * Email, provider-agnostic. EMAIL_PROVIDER = brevo | outbox | mock (auto: brevo when its keys are set).
 * "outbox" means no mailer: approved emails wait in Cockpit › Outbox. A new company = one adapter file + one case.
 */
export type Mail = { to: string; subject: string; text: string; unsubscribeUrl?: string };
export type Mailer = { provider: string; send: (m: Mail) => Promise<string> };

/** Records every mail instead of sending it (tests, demos). */
export function mockMailer(): Mailer & { sent: Mail[] } {
  const sent: Mail[] = [];
  return { provider: "mock", sent, send: async (m) => (sent.push(m), `mock-${sent.length}`) };
}

export function mailerFromEnv(env: Env = process.env): Mailer | null {
  switch (chosen("email", env)) {
    case "brevo":
      return env.BREVO_API_KEY && env.MAIL_FROM ? brevoMailer(env) : null;
    case "mock":
      return mockMailer();
    default:
      return null;
  }
}
