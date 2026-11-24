import { randomUUID } from "node:crypto";
import { hashPassword, verifyPassword } from "better-auth/crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { account, auditLog, memberships, organizations, session, user } from "@/db/schema";
import type { AdminChat } from "@/providers/admin-chat";
import type { Mailer } from "@/providers/email";
import { audit } from "./events";

/*
 * The founder's cockpit login. ADMIN_EMAIL / ADMIN_PASSWORD (hosting settings) always win: every deploy runs
 * scripts/seed.ts, which calls ensureAdmin, so changing the password in Vercel + a redeploy is a reset that
 * cannot lock anyone out (an unchanged ADMIN_PASSWORD leaves a password set via "Forgot password?" alone). "Forgot password" on the login pages sends a one-hour link (sendResetLink).
 */

export const MIN_PASSWORD = 12;

/** Email the way logins compare it: trimmed, lower case (pasting into a settings box often adds a space). */
export const normEmail = (e: string) => e.trim().toLowerCase();

export type EnsureAdminResult = { email: string; created: boolean; passwordChanged: boolean };

/** Creates the internal organisation and the admin, or brings an existing admin back to the given password. */
export async function ensureAdmin(db: Db, input: { email: string; password: string; name?: string }): Promise<EnsureAdminResult> {
  const email = normEmail(input.email);
  const password = input.password.trim();
  if (password.length < MIN_PASSWORD) throw new Error(`ADMIN_PASSWORD must be at least ${MIN_PASSWORD} characters`);

  await db.insert(organizations).values({ name: "Internal", slug: "internal", kind: "internal" }).onConflictDoNothing();
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, "internal"));

  let [admin] = await db.select().from(user).where(eq(user.email, email));
  const created = !admin;
  if (!admin) {
    [admin] = await db
      .insert(user)
      .values({ id: randomUUID(), name: input.name?.trim() || "Admin", email, emailVerified: true, role: "admin" })
      .returning();
  } else if (admin.role !== "admin") {
    await db.update(user).set({ role: "admin" }).where(eq(user.id, admin.id));
  }
  await db.insert(memberships).values({ orgId: org.id, userId: admin.id, role: "owner" }).onConflictDoNothing();

  // The password. ADMIN_PASSWORD is applied when it is NEW (changed in the hosting settings since the last deploy),
  // so a password chosen through "Forgot password?" is not undone by the next deploy. The last applied value is
  // remembered only as a salted hash (same kind as the login's own) in the audit log.
  const [cred] = await db.select().from(account).where(and(eq(account.userId, admin.id), eq(account.providerId, "credential")));
  const [last] = await db
    .select({ after: auditLog.after })
    .from(auditLog)
    .where(and(eq(auditLog.subjectType, "user"), eq(auditLog.subjectId, admin.id), inArray(auditLog.action, ["team.admin_created", "team.admin_password_set"])))
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(1);
  const lastHash = (last?.after as { envHash?: string } | null)?.envHash ?? cred?.password;
  const unchanged = lastHash ? await verifyPassword({ hash: lastHash, password }).catch(() => false) : false;
  const apply = !cred || !unchanged;
  if (!cred) {
    await db.insert(account).values({ id: randomUUID(), accountId: admin.id, providerId: "credential", userId: admin.id, password: await hashPassword(password) });
  } else if (apply) {
    await db.update(account).set({ password: await hashPassword(password), updatedAt: new Date() }).where(eq(account.id, cred.id));
    // an old password may be known to someone else: sign out every device
    await db.delete(session).where(eq(session.userId, admin.id));
  }
  const passwordChanged = !created && apply;
  if (created || passwordChanged) {
    await audit(db, { type: "system", id: "deploy" }, created ? "team.admin_created" : "team.admin_password_set", { type: "user", id: admin.id }, null, {
      email,
      envHash: await hashPassword(password),
    });
  }
  return { email, created, passwordChanged };
}

/** Where a reset link went. Never the link itself in logs. */
export type ResetDelivery = { email: boolean; phone: boolean };

/**
 * Sends a "forgot password" link. Everyone gets it by email; the founder (admin) also on the phone channel,
 * because the admin address in the hosting settings may not be a real inbox.
 */
export async function sendResetLink(
  db: Db,
  target: { id: string; email: string; role?: string | null },
  url: string,
  deps: { mailer: Mailer | null; adminChat: AdminChat | null },
): Promise<ResetDelivery> {
  const out: ResetDelivery = { email: false, phone: false };
  if (deps.mailer) {
    try {
      await deps.mailer.send({
        to: target.email,
        subject: "Reset your Legend Partner password",
        text: `Someone (hopefully you) asked to reset the password for ${target.email}.\n\nChoose a new password here (the link works for 1 hour, once):\n${url}\n\nIf this was not you, ignore this email: nothing changes.`,
      });
      out.email = true;
    } catch (e) {
      console.error("reset email failed:", (e as Error).message);
    }
  }
  if (target.role === "admin" && deps.adminChat) {
    try {
      await deps.adminChat.alert([`🔑 Password reset asked for ${target.email}.`, "Open this link to choose a new password (works for 1 hour, once). Not you? Ignore it.", url]);
      out.phone = true;
    } catch (e) {
      console.error("reset phone message failed:", (e as Error).message);
    }
  }
  await audit(db, { type: "user", id: target.id }, "auth.password_reset_requested", { type: "user", id: target.id }, null, out);
  return out;
}

/** After a reset link was used. */
export async function passwordWasReset(db: Db, userId: string) {
  await audit(db, { type: "user", id: userId }, "auth.password_reset_done", { type: "user", id: userId }, null, null);
}
