import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { agentRuns, companyPages, contacts, events, inbox, leads, prospects, touches } from "@/db/schema";
import { getLivePage, recordView } from "@/server/company-pages";
import { handleWhatsApp, parseWebhook, validSignature } from "@/server/whatsapp";
import { startCheckup, requestCall, unlockCheckup } from "@/server/checkup";
import { addProspect, channelStats, crmFunnel, lookalike, outreachQueue, priority, prospectKey, setLegalBasis, setRpo, setStage } from "@/server/crm";
import { approveSequence, completeTouch, loadSequences, loadTemplates, optOut, sendDueEmails, setSwitch } from "@/server/outreach";
import { channelCheck } from "@/server/outreach-rules";
import { createApiKey } from "@/server/api-keys";
import { useTestDb } from "./helpers";

const javad = { type: "user", id: "javad" } as const;
const env = { appUrl: "https://lp.test", sender: "Javad", brand: "Legend Partner" };
const now = new Date("2026-10-23T09:00:00Z");
const company = {
  name: "Carpenteria Rossi Srl",
  website: "https://www.carpenteriarossi.it/chi-siamo",
  phone: "+39 02 1234567",
  industry: "metal",
  country: "it",
  city: "Brescia",
  source: "maps",
  signals: { affectedByObligation: ["cbam-2028"], seenAt: "2026-10-20" },
  criterionScores: { fit: 9, need: 6, reach: 2 },
  contacts: [{ name: "Marco Rossi", role: "Titolare", email: "marco@carpenteriarossi.it", linkedinUrl: "https://www.linkedin.com/in/marco-rossi", source: "apollo" }],
  cost: { eur: 0.012, meta: { apify: 1 } },
};

describe("outreach rules (Italy)", () => {
  it("cold email and AI calls run only when switched on and a legal basis is recorded; human calls after the Registro check", () => {
    expect(channelCheck("email", { country: "IT", email: "info@x.it", emailConsent: true })).toBeNull();
    expect(channelCheck("email", { country: "IT", email: "info@x.it" })).toBe("cold email is switched off for IT");
    expect(channelCheck("email", { country: "IT", email: "info@x.it", switches: { "email-cold": true } })).toBe("no legal basis recorded for this contact");
    expect(channelCheck("email", { country: "IT", email: "info@x.it", switches: { "email-cold": true }, legalBasis: "legitimate_interest" })).toBeNull();
    const checked = { country: "IT", phone: "02 1", rpoCheckedAt: new Date("2026-10-20"), rpoListed: false };
    expect(channelCheck("phone", checked, now, true)).toBe("AI voice calls are switched off for IT");
    expect(channelCheck("phone", { ...checked, switches: { "voice-ai": true } }, now, true)).toBe("no legal basis recorded for an AI call");
    expect(channelCheck("phone", { ...checked, switches: { "voice-ai": true }, legalBasis: "consent" }, now, true)).toBeNull();
    expect(channelCheck("phone", { country: "IT", phone: "02 1", switches: { "voice-ai": true }, callbackRequested: true }, now, true)).toBeNull();
    expect(channelCheck("phone", { country: "IT", phone: "02 1" }, now)).toMatch(/Registro/);
    expect(channelCheck("phone", { country: "IT", phone: "02 1", rpoCheckedAt: new Date("2026-10-01") }, now)).toMatch(/Registro/); // older than 15 days
    expect(channelCheck("phone", { country: "IT", phone: "02 1", rpoCheckedAt: new Date("2026-10-20"), rpoListed: false }, now)).toBeNull();
    expect(channelCheck("phone", { country: "IT", phone: "02 1", rpoCheckedAt: new Date("2026-10-20"), rpoListed: true }, now)).toMatch(/is in the Registro/);
    expect(channelCheck("phone", { country: "DE", phone: "030 1" })).toBe("cold calls not allowed here");
  });

  it("every sequence step has a text in Italian and Persian for both industries", () => {
    const steps = new Set(Object.values(loadSequences()).flatMap((s) => s.steps.map((x) => x.id)));
    for (const industry of ["installers", "metal"]) {
      const t = loadTemplates(industry);
      for (const step of steps) expect(Object.keys(t.steps[step] ?? {}).sort(), `${industry}/${step}`).toEqual(["fa", "it"]);
      expect(t.steps["li-connect"].it.body.length).toBeLessThan(300 - 120); // LinkedIn note limit, room for slots
    }
  });

  it("one company per website host", () => {
    expect(prospectKey({ name: "X", website: "https://www.Rossi.it/a" })).toBe("rossi.it");
    expect(prospectKey({ name: "Rossi Srl", city: "Brescia" })).toBe("rossi-srl|brescia");
  });
});

describe("outbound CRM", () => {
  const db = useTestDb();

  it("plans the cold sequence, keeps cold steps parked until switched on, waits for approval, then works the tasks", async () => {
    const { id: apiKeyId } = await createApiKey(db, { name: "company-finder", scopes: ["crm:write"] });
    const finder = { type: "agent", id: "company-finder", apiKeyId } as const;
    const r = await addProspect(db, finder, company, env, now);
    expect(r.duplicate).toBe(false);
    expect((await addProspect(db, finder, { ...company, website: "carpenteriarossi.it" }, env, now)).duplicate).toBe(true);
    const [c] = await db.select().from(contacts);
    expect(c).toMatchObject({ email: "marco@carpenteriarossi.it", legalBasis: null }); // an agent never sets a legal basis
    expect((await db.select().from(agentRuns)).length).toBe(2);

    const planned = await db.select().from(touches).where(eq(touches.prospectId, r.id!));
    expect(planned.map((t) => [t.step, t.status, t.blockedReason])).toEqual([
      ["li-connect", "draft", null],
      ["email-cold-1", "draft", "cold email is switched off for IT"],
      ["call-1", "draft", "check the number in the Registro delle Opposizioni first"],
      ["li-message", "draft", null],
      ["email-cold-2", "draft", "cold email is switched off for IT"],
      ["li-followup", "draft", null],
      ["call-2", "draft", "check the number in the Registro delle Opposizioni first"],
    ]);
    const note = planned[0];
    expect(note.body).toContain("Buongiorno Marco,");
    expect(note.body).toContain("CBAM");
    expect(note.bodyFa).toContain("CBAM");
    const page = (await db.select().from(companyPages))[0];
    expect(page).toMatchObject({ prospectId: r.id, status: "draft", locale: "it-it" });
    expect(planned[3].body).toContain(`https://lp.test/it-it/for/${page.code}`);
    expect(await getLivePage(db, page.code)).toBeNull(); // not live before Javad approves
    expect(planned[2].body).toMatch(/^APERTURA: Buongiorno, sono Javad di Legend Partner\./);

    let q = await outreachQueue(db, now);
    expect(q.approvals).toHaveLength(1);
    expect(q.tasks).toHaveLength(0);
    await approveSequence(db, javad, r.id!, now);
    const live = await getLivePage(db, page.code);
    expect(live!.doc.estimate.report).toMatchObject({ industry: "metal" });
    expect(live!.doc.persona.summary).toContain("Carpenteria Rossi Srl");
    expect(live!.doc.facts.map((f) => f.source.url)).toContain("https://www.carpenteriarossi.it/chi-siamo");
    q = await outreachQueue(db, now);
    expect(q.tasks.map((t) => t.t.step)).toEqual(["li-connect"]);

    await completeTouch(db, javad, note.id, "sent", now);
    const later = new Date(now.getTime() + 2.1 * 864e5);
    q = await outreachQueue(db, later);
    const call = q.tasks.find((t) => t.t.step === "call-1")!;
    expect(call.why).toMatch(/Registro/);
    await expect(completeTouch(db, javad, call.t.id, "no_answer", later)).rejects.toMatchObject({ code: "conflict" });
    await setRpo(db, javad, r.id!, false, later);
    await completeTouch(db, javad, call.t.id, "interested", later);

    const [p] = await db.select().from(prospects).where(eq(prospects.id, r.id!));
    expect(p.stage).toBe("interested");
    expect(p.contactedAt).not.toBeNull();
    expect(p.repliedAt).not.toBeNull(); // every step it passed is stamped
    const open = (await db.select().from(touches).where(eq(touches.prospectId, r.id!))).filter((t) => t.status === "approved");
    expect(open).toEqual([]); // the sequence stops once they answer

    const f = await crmFunnel(db, later);
    expect(f.outbound[0]).toMatchObject({ industry: "metal", companies: 1, contacted: 1, replied: 1, interested: 1, won: 0 });
    expect(f.outbound[0].diagnosis.fix).toBe("wait");
    expect(f.costEur).toBeCloseTo(0.024);
    expect((await channelStats(db)).find((c) => c.channel === "phone")).toMatchObject({ done: 1, replies: 1 });
    await setStage(db, javad, r.id!, "contacted");
    expect((await db.select().from(prospects))[0].stage).toBe("interested"); // never backwards
    expect(priority({ ...p, createdAt: now }, now).tier).toBe(1);
  });

  it("check-up: unlock starts the warm emails, a call request becomes a task due now, opt-out stops everything", async () => {
    const site = { type: "system", id: "public-site" } as const;
    const metal = { work: ["import"], team: "m", quotes: "mid", quoteHours: "mid", lost: "mid", followUp: "never", orderValue: "mid", docs: "mid", hourly: "mid" };
    const { id } = await startCheckup(db, site, { industry: "metal", country: "it", locale: "it-it", entrance: "page", answers: metal });
    await unlockCheckup(db, site, id, { email: "anna@officina-bianchi.it", consent: true, consentText: "Acconsento a ricevere il report e offerte per il mio settore." });
    let [p] = await db.select().from(prospects);
    expect(p).toMatchObject({ name: "officina-bianchi.it", source: "checkup", stage: "interested", sequence: "warm" });
    let ts = await db.select().from(touches);
    expect(ts.map((t) => [t.step, t.status])).toEqual([["email-1", "draft"], ["email-2", "draft"], ["call-1", "skipped"], ["email-3", "draft"]]); // no phone yet

    await requestCall(db, site, id, { phone: "+39 333 1234567, dopo le 17" });
    [p] = await db.select().from(prospects);
    expect(p.sequence).toBe("callback");
    const q = await outreachQueue(db);
    expect(q.tasks.map((t) => [t.t.step, t.why])).toEqual([["call-now", null]]);

    // Brevo-like mailer: only consented, approved, due emails go out
    const sent: string[] = [];
    const mailer = { provider: "test", send: async (m: { to: string }) => (sent.push(m.to), "msg-1") };
    await approveSequence(db, javad, p.id);
    ts = await db.select().from(touches).where(eq(touches.status, "approved"));
    const email2 = ts.find((t) => t.step === "email-2")!;
    expect(await sendDueEmails(db, mailer, new Date(Date.now() + 4 * 864e5))).toEqual({ due: 1, sent: 1 });
    expect(sent).toEqual(["anna@officina-bianchi.it"]);
    expect(email2.body).toContain(`/api/v1/outreach/optout?t=${email2.id}`);

    await optOut(db, email2.id);
    [p] = await db.select().from(prospects);
    expect(p.stage).toBe("do_not_contact");
    expect((await db.select().from(leads))[0].unsubscribedAt).not.toBeNull();
    expect((await db.select().from(touches)).filter((t) => t.status === "approved")).toEqual([]);
    expect((await db.select().from(events)).map((e) => e.type)).toContain("prospect.opted_out");
  });

  it("cold email goes out only after Javad switches it on and records a legal basis; a page visit can trigger a warm call", async () => {
    const { id: apiKeyId } = await createApiKey(db, { name: "company-finder", scopes: ["crm:write"] });
    const r = await addProspect(db, { type: "agent", id: "company-finder", apiKeyId }, company, env, now);
    await approveSequence(db, javad, r.id!, now);
    const sent: string[] = [];
    const mailer = { provider: "test", send: async (m: { to: string }) => (sent.push(m.to), "id") };
    const day2 = new Date(now.getTime() + 1.5 * 864e5);
    expect(await sendDueEmails(db, mailer, day2)).toEqual({ due: 1, sent: 0 });
    await setSwitch(db, javad, "IT", "email-cold", true);
    expect(await sendDueEmails(db, mailer, day2)).toEqual({ due: 1, sent: 0 }); // still no legal basis
    const [c] = await db.select().from(contacts);
    await setLegalBasis(db, javad, c.id, "legitimate_interest", "Javad's decision 2026-10-23");
    expect(await sendDueEmails(db, mailer, day2)).toEqual({ due: 1, sent: 1 });
    expect(sent).toEqual(["marco@carpenteriarossi.it"]);

    // warm call: off by default; with the switch, the first page view plans a call due now
    const page = (await db.select().from(companyPages))[0];
    await setSwitch(db, javad, "IT", "call-warm", true);
    await db.update(touches).set({ status: "cancelled" }).where(eq(touches.channel, "phone"));
    expect(await recordView(db, page.code, day2)).toBe(1);
    const warm = (await db.select().from(touches)).filter((t) => t.step === "call-warm");
    expect(warm.map((t) => t.status)).toEqual(["approved"]);
    expect((await db.select().from(events)).map((e) => e.type)).toContain("company_page.viewed");
    const [p] = await db.select().from(prospects);
    expect(p.signals).toMatchObject({ pageViews: 1 });
    expect(p.sequence).toBe("cold");
  });

  it("WhatsApp: answers within the webhook, links the number to the company, and stops its sequence", async () => {
    const { id: apiKeyId } = await createApiKey(db, { name: "company-finder", scopes: ["crm:write"] });
    const r = await addProspect(db, { type: "agent", id: "company-finder", apiKeyId }, company, env, now);
    const body = { entry: [{ changes: [{ value: { contacts: [{ wa_id: "390212345 67".replace(" ", ""), profile: { name: "Marco" } }], messages: [{ from: "39021234567", id: "wamid.1", type: "text", text: { body: "Ciao, ho visto il vostro messaggio" } }] } }] }] };
    expect(parseWebhook(body)).toEqual([{ from: "39021234567", id: "wamid.1", text: "Ciao, ho visto il vostro messaggio", name: "Marco" }]);
    const calls: { url: string; body: string }[] = [];
    const fakeFetch = (async (url: string, init: { body: string }) => (calls.push({ url, body: init.body }), new Response(JSON.stringify({ messages: [{ id: "wamid.out" }] })))) as unknown as typeof fetch;
    const cfg = { token: "t", phoneNumberId: "123", verifyToken: "v", appSecret: null };
    expect(await handleWhatsApp(db, cfg, body, null, fakeFetch)).toEqual({ answered: 1 });
    expect(await handleWhatsApp(db, cfg, body, null, fakeFetch)).toEqual({ answered: 0 }); // same delivery twice
    expect(JSON.parse(calls[0].body)).toMatchObject({ to: "39021234567", text: { body: expect.stringContaining("assistente virtuale") } });
    const rows = await db.select().from(inbox);
    expect(rows.map((m) => [m.direction, m.prospectId])).toEqual([["in", r.id], ["out", r.id]]);
    expect((await db.select().from(prospects))[0].stage).toBe("replied");
    expect(validSignature("{}", "sha256=00", "secret")).toBe(false);
  });

  it("ranks firms that look like our buyers higher", () => {
    const base = { industry: "metal", region: "Lombardia", staff: 30, signals: { affectedByObligation: ["x"], category: "Carpenteria" } };
    expect(lookalike(base, [{ ...base }])).toBe(1);
    expect(lookalike({ ...base, region: "Sicilia", signals: {} }, [base])).toBeLessThan(0.5);
    const p = { ...base, criterionScores: { fit: 8, need: 5 }, createdAt: now, source: "maps" };
    expect(priority(p, now, [base as never]).score).toBeGreaterThan(priority(p, now).score);
  });
});
