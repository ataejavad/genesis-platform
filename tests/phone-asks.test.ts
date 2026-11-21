import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { auditLog, companyPages, partners, phoneAsks, touches } from "@/db/schema";
import { mockAdminChat, telegramChat, type ApprovalPress, type TelegramConfig } from "@/providers/admin-chat";
import { handlePress, sendWaitingAsks } from "@/server/admin-chat";
import { addProspect } from "@/server/crm";
import { approveSequence, editTouch } from "@/server/outreach";
import { applyPartner } from "@/server/partners";
import { javad, useTestDb } from "./helpers";

const db = useTestDb();
const env = { appUrl: "https://lp.test", sender: "Javad", brand: "Legend Partner" };
const now = new Date("2026-11-21T09:00:00Z");
const finder = { type: "system", id: "finder" } as const;
const company = (over: Record<string, unknown> = {}) => ({
  name: "Impianti Bianchi Srl",
  website: "https://www.impiantibianchi.it",
  industry: "installers",
  country: "it",
  city: "Milano",
  source: "import",
  signals: {},
  contacts: [{ name: "Paolo Bianchi", role: "Titolare", email: "paolo@impiantibianchi.it", source: "apollo" }],
  ...over,
});

/** Steps that can still go out (a LinkedIn step without a LinkedIn contact is skipped from the start). */
const open = async () => (await db.select().from(touches)).filter((t) => t.status !== "skipped");

/** A press as the adapter reads it; `said` collects what the chat answered. */
function pressOf(id: string, decision: "approved" | "rejected", over: Partial<ApprovalPress> = {}) {
  const said: string[] = [];
  const press: ApprovalPress = { target: "ask", id, decision, by: "7", allowed: true, ack: async (t) => void said.push(t), ...over };
  return { press, said };
}

describe("approve and reject on the phone", () => {
  it("asks once per company after research, and approving runs the cockpit's approval", async () => {
    const r = await addProspect(db, finder, company(), env, now);
    await addProspect(db, finder, company({ name: "Waiting Srl", website: "https://waiting.it", source: "maps" }), env, now); // research not done yet
    const chat = mockAdminChat();
    expect((await sendWaitingAsks(db, chat)).sent).toBe(1);
    expect((await sendWaitingAsks(db, chat)).sent).toBe(0); // never twice
    const ask = chat.decisions[0];
    expect(ask.title).toContain("Impianti Bianchi Srl");
    expect(ask.link).toBe(`/cockpit/crm/${r.id}`);
    expect(ask.lines.join("\n")).toContain("ترجمه فارسی");

    const { press, said } = pressOf(ask.ref, "approved");
    expect(await handlePress(db, press)).toBe("approved");
    expect(said[0]).toMatch(/تأیید شد/);
    const list = (await open()).filter((t) => t.prospectId === r.id);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((t) => t.status === "approved" && t.approvedBy === "telegram:7")).toBe(true);
    expect((await db.select().from(companyPages).where(eq(companyPages.prospectId, r.id!)))[0].status).toBe("live");
    const [row] = await db.select().from(phoneAsks);
    expect(row).toMatchObject({ status: "approved", decidedBy: "telegram:7" });
    expect(row.decidedAt).not.toBeNull();
    expect((await db.select().from(auditLog)).some((a) => a.action === "outreach.approved" && a.actor === "telegram:7")).toBe(true);

    // a second press (double tap, or the reject button afterwards) changes nothing
    const again = pressOf(ask.ref, "rejected");
    expect(await handlePress(db, again.press)).toBe("approved");
    expect(again.said[0]).toMatch(/قبلاً/);
    expect((await db.select().from(touches).where(eq(touches.status, "approved"))).length).toBe(list.length);
  });

  it("ignores presses from anyone else and logs them", async () => {
    await addProspect(db, finder, company(), env, now);
    const chat = mockAdminChat();
    await sendWaitingAsks(db, chat);
    const { press, said } = pressOf(chat.decisions[0].ref, "approved", { by: "666", allowed: false });
    expect(await handlePress(db, press)).toBeNull();
    expect(said[0]).toMatch(/اجازه/);
    expect((await open()).every((t) => t.status === "draft")).toBe(true);
    expect((await db.select().from(auditLog)).map((a) => [a.action, a.actor])).toContainEqual(["phone.press_denied", "telegram:666"]);
  });

  it("a press on an edited text does nothing and the new text is asked", async () => {
    await addProspect(db, finder, company(), env, now);
    const chat = mockAdminChat();
    await sendWaitingAsks(db, chat);
    const [first] = await db.select().from(touches).where(eq(touches.position, 0));
    await editTouch(db, javad, first.id, { body: "Buongiorno Paolo, testo nuovo." });
    const { press } = pressOf(chat.decisions[0].ref, "approved");
    expect(await handlePress(db, press)).toBe("stale");
    expect((await open()).every((t) => t.status === "draft")).toBe(true);
    expect((await sendWaitingAsks(db, chat)).sent).toBe(1);
    const fresh = pressOf(chat.decisions[1].ref, "approved");
    expect(await handlePress(db, fresh.press)).toBe("approved");
  });

  it("reject after a cockpit approval keeps the approved sequence", async () => {
    const r = await addProspect(db, finder, company(), env, now);
    const chat = mockAdminChat();
    await sendWaitingAsks(db, chat);
    await approveSequence(db, javad, r.id!, now);
    const { press, said } = pressOf(chat.decisions[0].ref, "rejected");
    expect(await handlePress(db, press)).toBe("elsewhere");
    expect(said[0]).toMatch(/کابین/);
    expect((await open()).every((t) => t.status === "approved")).toBe(true);
  });

  it("rejecting cancels the drafts; partner applications are decided the same way", async () => {
    await addProspect(db, finder, company(), env, now);
    const a = await applyPartner(db, { kind: "person", name: "Anna Neri", email: "anna@example.com", country: "IT", languages: ["it"], skills: ["automation"], consent: true });
    const chat = mockAdminChat();
    expect((await sendWaitingAsks(db, chat)).sent).toBe(2);
    expect(await handlePress(db, pressOf(chat.decisions[0].ref, "rejected").press)).toBe("rejected");
    expect((await open()).every((t) => t.status === "cancelled")).toBe(true);
    const partnerAsk = chat.decisions.find((d) => d.title.includes("Anna Neri"))!;
    expect(await handlePress(db, pressOf(partnerAsk.ref, "approved").press)).toBe("approved");
    const [p] = await db.select().from(partners).where(eq(partners.id, a.id));
    expect(p.status).toBe("active");
  });
});

describe("Telegram adapter for decision buttons", () => {
  const cfg: TelegramConfig = { botToken: "T", adminChatId: "42", adminUserIds: ["7"], appUrl: "https://app.test", webhookSecret: "s3cret" };
  const hook = new Headers({ "x-telegram-bot-api-secret-token": "s3cret" });
  const ref = "0b7c2a4e-1111-4222-8333-944455556666";

  it("sends approve, reject and an open-in-cockpit link", async () => {
    const f = vi.fn(async () => Response.json({ ok: true, result: { message_id: 5 } })) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
    expect(await telegramChat(cfg, f).askDecision({ ref, title: "T <b>", lines: ["x & y"], approveLabel: "OK", rejectLabel: "No", link: "/cockpit/crm/1" })).toBe("5");
    const body = JSON.parse(String(f.mock.calls[0][1].body));
    expect(body.text).toContain("T &lt;b&gt;");
    expect(body.reply_markup.inline_keyboard).toEqual([
      [{ text: "OK", callback_data: `d:${ref}:a` }, { text: "No", callback_data: `d:${ref}:r` }],
      [{ text: "✏️ باز کردن در کابین", url: "https://app.test/cockpit/crm/1" }],
    ]);
    expect(Buffer.byteLength(`d:${ref}:a`)).toBeLessThanOrEqual(64); // Telegram's callback limit
  });

  it("reads decision and content presses; only the founder in the founder's chat may decide", async () => {
    const chat = telegramChat(cfg, vi.fn() as unknown as typeof fetch);
    const cq = (from: number, chatId: number, data: string) => ({ callback_query: { id: "c", from: { id: from }, data, message: { message_id: 1, chat: { id: chatId } } } });
    expect(await chat.readPress(hook, cq(7, 42, `d:${ref}:r`))).toMatchObject({ target: "ask", id: ref, decision: "rejected", by: "7", allowed: true });
    expect(await chat.readPress(hook, cq(7, 42, `apr:${ref}:a`))).toMatchObject({ target: "approval", id: ref, decision: "approved", allowed: true });
    expect(await chat.readPress(hook, cq(8, 42, `d:${ref}:a`))).toMatchObject({ allowed: false });
    expect(await chat.readPress(hook, cq(7, 99, `d:${ref}:a`))).toMatchObject({ allowed: false }); // the bot in some group
    expect(await chat.readPress(hook, cq(7, 42, "d:not-an-id:a"))).toBeNull();
    expect(await chat.readPress(new Headers(), cq(7, 42, `d:${ref}:a`))).toBe("forbidden");
  });
});
