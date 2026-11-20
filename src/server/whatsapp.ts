import { and, asc, desc, eq, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { contacts, inbox, prospects } from "@/db/schema";
import type { Actor } from "./actor";
import { moveStage, planEnv } from "./crm";
import { audit, emit } from "./events";
import type { WhatsAppChannel } from "@/providers/whatsapp";

/*
 * WhatsApp Business agent (speed to lead, Javad 2026-10-23): every message gets an answer within seconds.
 * The WhatsApp provider (src/providers/whatsapp; Meta Cloud API today) calls /api/v1/whatsapp; we store the message in the inbox, link it to the
 * company (or create one), answer through the agent and alert Javad on Telegram. With an AI model connected the
 * agent answers freely from the catalogue; without it, a short scripted reply that points to the check-up.
 * WhatsApp's own rule: free-form replies only within 24 hours of the customer's last message.
 */

export { digits } from "@/providers/whatsapp";

export type Reply = (input: { lang: string; industry: string | null; company: string | null; history: { role: "user" | "assistant"; text: string }[] }) => Promise<string>;

const SCRIPTED: Record<string, { first: string; next: string }> = {
  it: {
    first: "Ciao, sono l'assistente virtuale di {brand} (un'IA). Dimmi in una frase il vostro mestiere e cosa vi fa perdere più tempo; intanto il check-up gratuito di 2 minuti è qui: {url}",
    next: "Grazie, ho girato il messaggio a {sender}: ti risponde a breve. Se vuoi, intanto fai il check-up: {url}",
  },
  en: {
    first: "Hi, this is {brand}'s virtual assistant (an AI). Tell me your trade and what costs you most time; meanwhile the free 2-minute check-up is here: {url}",
    next: "Thanks, I passed this to {sender}, who will answer shortly. Meanwhile you can do the check-up: {url}",
  },
};

export const scriptedReply = (lang: string, first: boolean, url: string, env = planEnv()) =>
  (SCRIPTED[lang] ?? SCRIPTED.en)[first ? "first" : "next"].replace("{brand}", env.brand).replace("{sender}", env.sender).replace("{url}", url);

/** Handles one webhook call: store, link to the company, answer, alert. Duplicate deliveries are ignored. */
export async function handleWhatsApp(db: Db, channel: WhatsAppChannel, body: unknown, reply: Reply | null) {
  const actor: Actor = { type: "system", id: "whatsapp" };
  const env = planEnv();
  let answered = 0;
  for (const m of channel.parse(body)) {
    const stored = await db.transaction(async (tx) => {
      const [row] = await tx.insert(inbox).values({ channel: "whatsapp", direction: "in", party: m.from, body: m.text, providerId: m.id }).onConflictDoNothing().returning();
      if (!row) return null;
      // the company: same number (last 9 digits, so +39 and 0039 match) on the company or one of its contacts
      const tail = m.from.slice(-9);
      const same = (col: typeof prospects.phone | typeof contacts.phone) => sql`right(regexp_replace(coalesce(${col}, ''), '[^0-9]', '', 'g'), 9) = ${tail}`;
      const [known] = await tx
        .select({ p: prospects })
        .from(prospects)
        .leftJoin(contacts, eq(contacts.prospectId, prospects.id))
        .where(or(eq(prospects.key, `wa:${m.from}`), same(prospects.phone), same(contacts.phone)))
        .limit(1);
      let p: typeof prospects.$inferSelect | undefined = known?.p;
      if (!p) {
        [p] = await tx
          .insert(prospects)
          .values({ name: m.name ?? `+${m.from}`, key: `wa:${m.from}`, phone: `+${m.from}`, industry: "unknown", country: m.from.startsWith("39") ? "IT" : m.from.startsWith("49") ? "DE" : "XX", source: "whatsapp" })
          .returning();
        await tx.insert(contacts).values({ prospectId: p.id, name: m.name ?? null, phone: `+${m.from}`, source: "whatsapp", legalBasis: "consent", basisSource: "wrote to us on WhatsApp" });
      }
      await tx.update(inbox).set({ prospectId: p.id }).where(eq(inbox.id, row.id));
      // writing to us is a reply: the sequence stops and the funnel counts it
      if (p.source !== "whatsapp") await moveStage(tx, actor, p.id, "replied", new Date(), "whatsapp message");
      await emit(tx, actor, "whatsapp.received", { type: "prospect", id: p.id }, { from: `+${m.from}`, text: m.text.slice(0, 200) });
      await audit(tx, actor, "whatsapp.received", { type: "prospect", id: p.id }, null, { inbox: row.id });
      return p;
    });
    if (!stored) continue;
    const history = await db
      .select()
      .from(inbox)
      .where(and(eq(inbox.channel, "whatsapp"), eq(inbox.party, m.from)))
      .orderBy(desc(inbox.createdAt))
      .limit(20);
    const lang = stored.country === "DE" ? "de" : stored.country === "IT" || m.from.startsWith("39") ? "it" : "en";
    const url = `${env.appUrl}/${lang}-${(stored.country === "XX" ? "it" : stored.country).toLowerCase()}/checkup?from=whatsapp`;
    const firstContact = history.filter((h) => h.direction === "out").length === 0;
    let text: string;
    try {
      text = reply
        ? await reply({ lang, industry: stored.industry === "unknown" ? null : stored.industry, company: stored.name, history: history.reverse().map((h) => ({ role: h.direction === "in" ? "user" : "assistant", text: h.body })) })
        : scriptedReply(lang, firstContact, url, env);
    } catch {
      text = scriptedReply(lang, firstContact, url, env);
    }
    const providerId = await channel.send(m.from, text);
    await db.insert(inbox).values({ prospectId: stored.id, channel: "whatsapp", direction: "out", party: m.from, body: text, author: reply ? "agent:whatsapp" : "agent:whatsapp-scripted", providerId });
    answered++;
  }
  return { answered };
}

export async function conversation(db: Db, prospectId: string) {
  return db.select().from(inbox).where(eq(inbox.prospectId, prospectId)).orderBy(asc(inbox.createdAt));
}
