import { afterEach, describe, expect, it, vi } from "vitest";
import { readSite, researchCompany } from "@/agents/company-research";
import { setLlmForTests } from "@/providers/llm";

const answer = JSON.stringify({
  facts: [{ text: "Installa pompe di calore a Milano dal 2005", source: { name: "Chi siamo", url: "https://rossi.it/chi-siamo" } }],
  persona: { summary: "Impiantista a Milano.", offers: ["Pompe di calore"], customers: null, pains: [{ text: "Telefonate perse", why: "solo un numero fisso" }], questions: ["Quante chiamate perdete?"] },
  personal: { local: "Ho letto che installate pompe di calore dal 2005.", fa: "خواندم که از ۲۰۰۵ پمپ حرارتی نصب می‌کنید." },
});
const site = (url: string) =>
  new Response(url.includes("chi-siamo") ? "<html><body><h1>Chi siamo</h1><p>Dal 2005 installiamo pompe di calore a Milano.</p><script>x()</script></body></html>" : '<html><body><a href="/chi-siamo">Chi siamo</a><p>Rossi Impianti</p></body></html>', { headers: { "content-type": "text/html" } });

afterEach(() => {
  setLlmForTests(null);
  vi.unstubAllGlobals();
});

describe("company research without web search (free tier)", () => {
  it("reads the home and about page as plain text", async () => {
    const r = await readSite("rossi.it", (async (u: string) => site(u)) as unknown as typeof fetch);
    expect(r.urls).toEqual(["https://rossi.it", "https://rossi.it/chi-siamo"]);
    expect(r.text).toContain("Dal 2005 installiamo pompe di calore");
    expect(r.text).not.toContain("x()");
  });

  it("falls back to the website when web search answers 429, and cites only the site", async () => {
    vi.stubGlobal("fetch", (async (u: string) => site(String(u))) as unknown as typeof fetch);
    const prompts: { search: boolean; text: string }[] = [];
    setLlmForTests({
      provider: "fake", model: "fake", webSearch: true,
      complete: async (req) => {
        prompts.push({ search: Boolean(req.webSearch), text: req.messages[0].content });
        if (req.webSearch) throw new Error("gemini 429 (gemini-flash-latest): You exceeded your current quota");
        return { text: answer, stop: "end", usage: { input: 10, output: 10, searches: 0 }, model: "fake" };
      },
    });
    const r = await researchCompany({ name: "Rossi Impianti", website: "https://rossi.it", city: "Milano", industry: "installers", country: "IT", signals: {} });
    expect(r.personal.local).toContain("2005");
    expect(prompts.map((p) => p.search)).toEqual([true, false]);
    expect(prompts[1].text).toContain("Use ONLY this text");
    expect(prompts[1].text).toContain("Dal 2005 installiamo");
  });

  it("without a website the quota error stays visible", async () => {
    setLlmForTests({ provider: "fake", model: "fake", webSearch: true, complete: async () => { throw new Error("gemini 429: quota"); } });
    await expect(researchCompany({ name: "X", industry: "installers", country: "IT", signals: {} })).rejects.toThrow(/429/);
  });
});
