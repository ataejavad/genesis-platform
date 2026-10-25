import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { deliveries, jobs, milestones, projects, servicePackages } from "@/db/schema";
import { addDocument, applyPartner, checkDocument, decideApplication, deliver, offerJob, offersFor, respondOffer, workFor } from "@/server/partners";
import { materialFile, materialTurn } from "@/server/portal-chat";
import { addInput, afterDelivery, convertOrder, createOrder, customerNeeds, decideInput, humanReview, partnerMaterials, projectInputsFor, qaQueue, seedDelivery, setQaBy } from "@/server/projects";
import { redact } from "@/server/redact";
import { useTestDb } from "./helpers";

process.env.FILES_DIR = mkdtempSync(path.join(tmpdir(), "genesis-files-"));
const db = useTestDb();
const javad = { type: "user", id: "javad" } as const;
const sys = { type: "system", id: "test" } as const;

async function partner(email: string, skills = ["automation", "crm", "ai-setup"]) {
  const a = await applyPartner(db, { kind: "company", name: `P ${email}`, email, country: "IT", languages: ["it", "en"], skills, consent: true });
  await decideApplication(db, javad, a.id, true, "a-long-test-password");
  await checkDocument(db, javad, (await addDocument(db, javad, a.id, "dpa", "https://example.com/dpa.pdf")).id, true);
  return a.id;
}

async function project(slug = "lead-crm") {
  await seedDelivery(db);
  const order = await createOrder(db, sys, { packageSlug: slug, source: "market", company: "Rossi Impianti Srl", email: "mario.rossi@rossi-impianti.it", country: "IT", industry: "installers", locale: "it" });
  const { projectId } = await convertOrder(db, javad, order.id);
  const [p] = await db.select().from(projects).where(eq(projects.id, projectId));
  return p;
}

describe("customer identity removed before partners see anything", () => {
  it("replaces company, people and identifiers", () => {
    const r = redact("Siamo Rossi Impianti Srl, chiedete a Mario Rossi (mario@rossi.it, +39 333 123 4567). P.IVA IT01234567890, IBAN IT60 X054 2811 1010 0000 0123 456, Via Roma 12, Milano. Sito www.rossi.it", { company: ["Rossi Impianti Srl"], people: ["Mario Rossi"] });
    expect(r.clean).not.toMatch(/Rossi|mario@|333|01234567890|IT60|Roma 12|www/);
    expect(r.clean).toContain("[CUSTOMER]");
    expect(redact("Ask Demo Customer at Rossi", { company: ["Rossi"], people: ["Demo Customer"] }).clean).toBe("Ask [PERSON] at [CUSTOMER]");
    expect(redact("Rossi Srl", { company: ["Rossi Srl"], people: ["Customer"] }).clean).toBe("[CUSTOMER]");
    expect(r.removed).toEqual(expect.arrayContaining(["company", "email", "phone", "tax id", "iban", "address", "link"]));
  });
});

describe("customer material → partners", () => {
  it("asks in the chat, saves the answer cleaned, and shows it to the project's partner", async () => {
    const pid = await partner("anna@example.com");
    const p = await project();
    for (const { offer } of await offersFor(db, pid)) await respondOffer(db, sys, pid, offer.id, true);
    const needs = await customerNeeds(db, p.orgId!, "it");
    expect(needs[0].needs.map((n) => n.text)).toEqual(["Accesso al modulo del sito", "Accesso al CRM", "Chi riceve l'avviso"]);

    const ask = await materialTurn(db, sys, p.orgId!, "it", "📎 Chi riceve l'avviso");
    expect(ask?.text).toContain("«Chi riceve l'avviso»");
    expect(await materialTurn(db, sys, p.orgId!, "it", "Quanto abbiamo recuperato?", "Ciao")).toBeNull();
    const got = await materialTurn(db, sys, p.orgId!, "it", "L'avviso va a Mario Rossi, 333 1234567", ask!.text);
    // thanks, then the next thing we need
    expect(got?.text).toContain("«Accesso al modulo del sito»");

    const mats = await partnerMaterials(db, p.id);
    expect(mats).toEqual([{ id: expect.any(String), label: "Who gets the alert", text: "L'avviso va a [PERSON], [PHONE]", file: null }]);
    const [w] = await workFor(db, pid);
    expect(w.materials).toHaveLength(1);
    expect((await customerNeeds(db, p.orgId!, "it"))[0].needs).toHaveLength(2);

    // a PDF waits for a person; a text file is cleaned and shared at once
    const pdf = await materialFile(db, sys, p.orgId!, "it", { name: "crm.pdf", type: "application/pdf", bytes: new TextEncoder().encode("%PDF-1.4") }, got!.text);
    expect(pdf.text).toContain("Lo controlliamo");
    expect(await partnerMaterials(db, p.id)).toHaveLength(1);
    const txt = await addInput(db, javad, { projectId: p.id, label: "Other", source: "file", file: { name: "note.txt", type: "text/plain", bytes: new TextEncoder().encode("Call with Rossi Impianti: they use Pipedrive.") } });
    expect(txt).toMatchObject({ status: "shared", cleanText: "Call with [CUSTOMER]: they use Pipedrive." });
    expect(await partnerMaterials(db, p.id)).toHaveLength(2);
    const [pdfRow] = (await projectInputsFor(db, p.id)).filter((i) => i.status === "check");
    await decideInput(db, javad, pdfRow.id, true);
    expect((await partnerMaterials(db, p.id)).find((m) => m.file)?.file?.url).toBe(`/api/files/${pdfRow.id}`);

    // another customer's project cannot be written to
    await expect(addInput(db, sys, { projectId: p.id, label: "x", source: "chat", text: "hello" }, "00000000-0000-0000-0000-000000000001")).rejects.toThrow();
    await expect(addInput(db, sys, { projectId: p.id, label: "x", source: "file", file: { name: "a.html", type: "text/html", bytes: new Uint8Array([1]) } })).rejects.toThrow();
  });
});

describe("several partners, assembly and QA partners", () => {
  it("assembles a milestone made by two partners before the customer sees it", async () => {
    await seedDelivery(db);
    await db.insert(servicePackages).values({ slug: "duo", title: "Duo", titles: { en: "Duo" }, setupEur: 600, monthlyEur: 100, milestones: [{ title: "All set", sharePct: 100 }], tasks: [
      { title: "Follow-up", brief: "b", protocol: "PR-07", skills: ["automation"], payEur: 150, days: 3, milestone: 0 },
      { title: "Lead form", brief: "b", protocol: "PR-03", skills: ["crm"], payEur: 200, days: 3, milestone: 0 },
    ] });
    const a = await partner("a@example.com", ["automation"]);
    const b = await partner("b@example.com", ["crm"]);
    const asm = await partner("asm@example.com", ["assembly"]);
    const p = await project("duo");
    const [t1, t2] = await db.select().from(jobs).where(eq(jobs.projectId, p.id));
    for (const pid of [a, b]) for (const { offer } of await offersFor(db, pid)) await respondOffer(db, sys, pid, offer.id, true).catch(() => null);
    for (const j of await db.select().from(jobs).where(eq(jobs.projectId, p.id))) {
      if (j.status !== "assigned") continue;
      const d = await deliver(db, sys, j.partnerId!, j.id, { link: `https://example.com/${j.title}`, selfCheck: j.checklist.map(() => true) });
      await humanReview(db, javad, d.id, j.checklist.map((_, idx) => ({ idx, result: "pass" as const })), 5, "ok");
    }
    expect([t1.id, t2.id].length).toBe(2);
    const all = await db.select().from(jobs).where(eq(jobs.projectId, p.id));
    const assembly = all.find((j) => j.role === "assemble")!;
    expect(assembly.brief).toContain("https://example.com/Follow-up");
    let [m] = await db.select().from(milestones).where(eq(milestones.projectId, p.id));
    expect(m.status).toBe("open");
    // the worker offers it (job.opened); only partners with the assembly skill match
    const offered = await offerJob(db, sys, assembly.id);
    expect(offered.map((o) => o.partnerId)).toEqual([asm]);
    for (const { offer } of await offersFor(db, asm)) await respondOffer(db, sys, asm, offer.id, true);
    const d = await deliver(db, sys, asm, assembly.id, { link: "https://example.com/all", selfCheck: assembly.checklist.map(() => true) });
    await humanReview(db, javad, d.id, assembly.checklist.map((_, idx) => ({ idx, result: "pass" as const })), 5, "ok");
    [m] = await db.select().from(milestones).where(eq(milestones.projectId, p.id));
    expect(m.status).toBe("ready");
  });

  it("lets a QA partner (never the maker) check a delivery; its verdict routes like the judge's", async () => {
    const maker = await partner("maker@example.com", ["automation", "crm", "qa"]);
    const qa = await partner("qa@example.com", ["qa"]);
    const p = await project();
    await setQaBy(db, javad, p.id, "partner");
    for (const { offer } of await offersFor(db, maker)) await respondOffer(db, sys, maker, offer.id, true);
    const [j] = await db.select().from(jobs).where(eq(jobs.projectId, p.id));
    const dl = await deliver(db, sys, maker, j.id, { link: "https://example.com/w", selfCheck: j.checklist.map(() => true) });
    expect(await afterDelivery(db, dl.id)).toMatchObject({ route: "qa-partner" });
    const qj = (await db.select().from(jobs).where(eq(jobs.reviewsDeliveryId, dl.id)))[0];
    expect(qj).toMatchObject({ role: "qa", skills: ["qa"] });
    expect(qj.brief).toContain("https://example.com/w");
    expect((await offerJob(db, sys, qj.id)).map((o) => o.partnerId)).toEqual([qa]);
    for (const { offer } of await offersFor(db, qa)) await respondOffer(db, sys, qa, offer.id, true);
    // the QA partner fails one criterion
    const report = await deliver(db, sys, qa, qj.id, { link: "https://example.com/qa-report", note: "Phone field empty", selfCheck: qj.checklist.map((_, i) => i !== 1) });
    expect(await afterDelivery(db, report.id)).toMatchObject({ route: "human" });
    const [queued] = await qaQueue(db);
    expect(queued.delivery.id).toBe(dl.id);
    expect(queued.judge).toMatchObject({ by: `partner:${qa}`, verdict: "changes" });
    // the QA partner's own job is done and paid
    expect((await db.select().from(deliveries).where(eq(deliveries.id, report.id)))[0].status).toBe("accepted");
  });
});
