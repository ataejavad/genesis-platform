import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import { extraOrigins } from "@/lib/platform";
import { adminChatFromEnv } from "@/providers/admin-chat";
import { mailerFromEnv } from "@/providers/email";
import { passwordWasReset, sendResetLink } from "@/server/team-login";

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    // Vercel preview links may sign in too (APP_URL / BETTER_AUTH_URL is the main address)
    trustedOrigins: extraOrigins(),
    emailAndPassword: {
      enabled: true,
      // Accounts are created by scripts/seed.ts (team) and, later, by the customer onboarding flow.
      disableSignUp: true,
      minPasswordLength: 12,
      // "Forgot password?" on the login pages: a one-hour, one-time link by email (founder: also on the phone)
      resetPasswordTokenExpiresIn: 3600,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendResetLink(getDb(), user as { id: string; email: string; role?: string }, url, { mailer: mailerFromEnv(), adminChat: adminChatFromEnv() });
      },
      onPasswordReset: async ({ user }) => passwordWasReset(getDb(), user.id),
    },
    user: {
      additionalFields: { role: { type: "string", input: false, defaultValue: "member" } },
    },
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
const globalForAuth = globalThis as unknown as { auth?: Auth };

// Lazy so `next build` works without a database.
export function getAuth(): Auth {
  globalForAuth.auth ??= createAuth();
  return globalForAuth.auth;
}

export async function getCurrentUser() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/login?error=forbidden");
  return user;
}
