/*
 * Email for business code. The company that sends it lives in src/providers/email (EMAIL_PROVIDER);
 * without a sender, approved emails wait in the outbox (the cockpit shows them).
 */
export { type Mail, type Mailer, mailerFromEnv } from "@/providers/email";
