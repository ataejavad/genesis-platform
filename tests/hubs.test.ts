import { describe, expect, it } from "vitest";
import { checkResearch, hubDrafts, loadFacts, loadResearch, parseHubDoc, ruleIsBacked, type HubResearch } from "@/server/hubs";

const now = new Date("2026-10-23T12:00:00Z");
const src = (url: string, kind: "official" | "press" | "association" = "press") => ({ name: url, url, date: "2026-10-20", kind });
const [installers] = loadResearch().filter((r) => r.industry === "installers");

describe("hub sourcing rules", () => {
  it("a rule needs one official source or two independent publishers", () => {
    expect(ruleIsBacked([src("https://eur-lex.europa.eu/a", "official")])).toBe(true);
    expect(ruleIsBacked([src("https://www.news.it/a"), src("https://news.it/b")])).toBe(false);
    expect(ruleIsBacked([src("https://news.it/a"), src("https://other.it/b")])).toBe(true);
  });

  it("drops unbacked deadlines, passed deadlines and old news", () => {
    const r: HubResearch = {
      ...installers,
      deadlines: [
        { ...installers.deadlines[0], id: "weak", sources: [src("https://blog.it/x")] },
        { ...installers.deadlines[0], id: "old", date: "2026-08-01" },
        installers.deadlines[0],
      ],
      news: [{ ...installers.news[0], date: "2026-05-01" }, installers.news[0]],
    };
    const { research, issues } = checkResearch(r, now);
    expect(research.deadlines.map((d) => d.id)).toEqual([installers.deadlines[0].id]);
    expect(research.news).toHaveLength(1);
    expect(issues.filter((i) => i.level === "dropped")).toHaveLength(3);
  });

  it("a hub with no backed deadline is not published", () => {
    const { drafts, issues } = hubDrafts({ ...installers, deadlines: [] }, null, now);
    expect(drafts).toHaveLength(0);
    expect(issues.some((i) => i.level === "error")).toBe(true);
  });
});

describe("hub pages", () => {
  it("builds one page per locale with official market numbers", () => {
    const { drafts, issues } = hubDrafts(installers, loadFacts(installers), now);
    expect(issues.filter((i) => i.level !== "warn")).toEqual([]);
    expect(drafts.map((d) => d.locale).sort()).toEqual(["de-de", "en-gb", "fa-ir", "it-it"]);
    const it = parseHubDoc(drafts.find((d) => d.locale === "it-it")!.body)!;
    const de = parseHubDoc(drafts.find((d) => d.locale === "de-de")!.body)!;
    expect(it.name).toBe(installers.name.it);
    expect(de.name).toBe(installers.name.en);
    expect(it.stats.find((s) => s.key === "firms")).toMatchObject({ value: 4968, period: "2024", source: "Eurostat sbs_sc_ovw" });
    expect(drafts[0].slug).toBe("hub/installers/it");
  });

  it("every hook option points at deadlines it can show", () => {
    for (const r of loadResearch()) {
      const tags = new Set(r.deadlines.flatMap((d) => d.tags));
      const options = r.hook.questions.flatMap((q) => q.options.map((o) => o.tag)).filter(Boolean);
      expect(options.filter((t) => !tags.has(t)), `${r.industry}`).toEqual([]);
    }
  });
});
