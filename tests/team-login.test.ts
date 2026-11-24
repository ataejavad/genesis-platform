import { verifyPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { account, auditLog, session, user } from "@/db/schema";
import { mockAdminChat } from "@/providers/admin-chat";
import { mockMailer } from "@/providers/email";
import { ensureAdmin, sendResetLink } from "@/server/team-login";
import { useTestDb } from "./helpers";

const db = useTestDb();
const PW1 = "first-password-123";
const PW2 = "second-password-456";

async function storedHash(userId: string) {
  const [a] = await db.select().from(account).where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
  return a.password!;
}

describe("cockpit admin login follows the hosting settings", () => {
  it("creates the admin, then a new ADMIN_PASSWORD replaces the old one and signs out every device", async () => {
    const a = await ensureAdmin(db, { email: "  Javad@Example.com ", password: PW1 });
    expect(a).toEqual({ email: "javad@example.com", created: true, passwordChanged: false });
    const [u] = await db.select().from(user).where(eq(user.email, "javad@example.com"));
    expect(u.role).toBe("admin");
    expect(await verifyPassword({ hash: await storedHash(u.id), password: PW1 })).toBe(true);

    await db.insert(session).values({ id: "s1", userId: u.id, token: "t1", expiresAt: new Date(Date.now() + 3600e3) });
    // same password again (every deploy): nothing changes, nobody is signed out
    expect((await ensureAdmin(db, { email: "javad@example.com", password: PW1 })).passwordChanged).toBe(false);
    expect(await db.select().from(session)).toHaveLength(1);

    const b = await ensureAdmin(db, { email: "javad@example.com", password: `${PW2}\n` });
    expect(b.passwordChanged).toBe(true);
    expect(await verifyPassword({ hash: await storedHash(u.id), password: PW2 })).toBe(true);
    expect(await verifyPassword({ hash: await storedHash(u.id), password: PW1 })).toBe(false);
    expect(await db.select().from(session)).toHaveLength(0);
    const logged = await db.select().from(auditLog).where(eq(auditLog.subjectId, u.id));
    expect(logged.map((l) => l.action).sort()).toEqual(["team.admin_created", "team.admin_password_set"]);
  });

  it("an unchanged ADMIN_PASSWORD does not undo a password set through the reset link", async () => {
    const { hashPassword } = await import("better-auth/crypto");
    await ensureAdmin(db, { email: "javad@example.com", password: PW1 });
    const [u] = await db.select().from(user).where(eq(user.email, "javad@example.com"));
    await db.update(account).set({ password: await hashPassword(PW2) }).where(eq(account.userId, u.id)); // what a reset does
    expect((await ensureAdmin(db, { email: "javad@example.com", password: PW1 })).passwordChanged).toBe(false);
    expect(await verifyPassword({ hash: await storedHash(u.id), password: PW2 })).toBe(true);
    // a NEW value in the hosting settings wins again
    expect((await ensureAdmin(db, { email: "javad@example.com", password: "third-password-789" })).passwordChanged).toBe(true);
    expect(await verifyPassword({ hash: await storedHash(u.id), password: "third-password-789" })).toBe(true);
  });

  it("refuses a short password", async () => {
    await expect(ensureAdmin(db, { email: "a@b.c", password: "short" })).rejects.toThrow(/12/);
  });

  it("sends the reset link by email, and to the founder's phone for the admin only", async () => {
    const { email } = await ensureAdmin(db, { email: "boss@example.com", password: PW1 });
    const [u] = await db.select().from(user).where(eq(user.email, email));
    const mailer = mockMailer();
    const chat = mockAdminChat();
    const url = "https://app.example/api/auth/reset-password/tok?callbackURL=%2Flogin%2Freset";

    expect(await sendResetLink(db, { id: u.id, email, role: "admin" }, url, { mailer, adminChat: chat })).toEqual({ email: true, phone: true });
    expect(mailer.sent[0].to).toBe(email);
    expect(mailer.sent[0].text).toContain(url);
    expect(chat.sent[0].lines.join("\n")).toContain(url);

    const r = await sendResetLink(db, { id: u.id, email, role: "member" }, url, { mailer, adminChat: chat });
    expect(r).toEqual({ email: true, phone: false });
    expect(chat.sent).toHaveLength(1);
  });
});
