import { costEur } from "./meter";
import { extractJson, llm, llmEnabled } from "@/providers/llm";
import { z } from "zod";
import { researchedPage } from "@/server/company-page-doc";

/*
 * Company research (research 2026-10-23, Javad: know the customer before the first contact). Claude reads the
 * firm's public footprint on the web and returns: facts with sources, a starter persona of the company, and
 * one personal opening line in the country language plus Persian for Javad. Off until an AI model with web search is connected;
 * then the page is built from the Maps data and the hub research, and the opening line from the signals.
 */

export const researchEnabled = () => llmEnabled({ webSearch: true });

const resultSchema = researchedPage.extend({ personal: z.object({ local: z.string().max(400), fa: z.string().max(400) }) });
export type CompanyResearch = z.infer<typeof resultSchema> & { costEur: number };

const LANG: Record<string, string> = { IT: "Italian", DE: "German" };

/**
 * Where the agent looks, per country (Javad 2026-10-25: website, company registers, LinkedIn and more).
 * Public pages only, read through web search: no logins, no scraping of LinkedIn (its User Agreement bans it),
 * company facts only (GDPR: nothing about people's private lives).
 */
export const SOURCES: Record<string, string[]> = {
  ALL: [
    "the company's own website (services, references, team size, certifications, news)",
    "Google Maps / Google Business profile and review themes",
    "LinkedIn company page and public posts as shown in search results (size, hiring, recent projects)",
    "job ads (Indeed, InfoJobs, the company site): hiring shows growth and where work piles up",
    "local and trade press, trade-association member lists, trade-fair exhibitor lists",
    "Facebook / Instagram business pages (recent work, customer questions)",
  ],
  IT: [
    "Registro Imprese via public company-data sites (ufficiocamerale.it, reportaziende.it, registroaziende.it): legal form, ATECO code, founding year, revenue band, employees",
    "public tenders and awards (ANAC open data, regional procurement portals)",
    "certifications (Accredia, SOA attestations for construction firms, F-gas register for installers)",
    "ENEA / Conto Termico and incentive lists where the firm appears as installer",
  ],
  DE: [
    "Handelsregister / Unternehmensregister and North Data: legal form, founding year, management, revenue band",
    "Handwerkskammer member directory, trade guild (Innung) listings",
    "public tenders (bund.de, TED)",
  ],
};
export const sourcesFor = (country: string) => [...SOURCES.ALL, ...(SOURCES[country.toUpperCase()] ?? [])];

export async function researchCompany(c: { name: string; website?: string; city?: string; industry: string; country: string; signals: Record<string, unknown> }, lessons: string[] = []): Promise<CompanyResearch> {
  const lang = LANG[c.country] ?? "English";
  const prompt = `Research this small company from public sources before we contact it: ${JSON.stringify({ name: c.name, website: c.website, city: c.city, trade: c.industry, country: c.country })}.
Known signals: ${JSON.stringify(c.signals)}.
Check these sources, as many as give something: ${sourcesFor(c.country).map((x) => `\n- ${x}`).join("")}
Find: what they do and for whom, services, size and revenue band, founding year, recent news, hiring, tenders won, certifications, review themes. Only facts you saw, each with its source URL. No guesses about people's private lives; company facts only.
Then write:
- persona: how this company would describe itself (summary ≤ 3 sentences in ${lang}), offers (≤ 6), customers (one line or null), 3 likely pains with the evidence that suggests each, 3 questions we should ask them. In ${lang}.
- personal: one opening sentence for a first message that refers to a real fact you found (no flattery, no invented numbers), in ${lang} ("local") and in Persian ("fa").
${lessons.length ? `What we learned about first messages (follow it):${lessons.map((l) => `\n- ${l}`).join("")}\n` : ""}Reply with one JSON object only: {"facts":[{"text":string,"source":{"name":string,"url":string}}],"persona":{"summary":string,"offers":[string],"customers":string|null,"pains":[{"text":string,"why":string}],"questions":[string]},"personal":{"local":string,"fa":string}}`;
  const ask = async (req: Parameters<ReturnType<typeof llm>["complete"]>[0]) => {
    const r = await llm().complete(req);
    if (r.stop === "refusal") throw new Error("research refused");
    if (r.stop === "max_tokens") throw new Error("research answer was cut off (max_tokens)");
    return { r, parsed: resultSchema.parse(extractJson(r.text)) };
  };
  let out: Awaited<ReturnType<typeof ask>>;
  try {
    out = await ask({ maxTokens: 16000, thinking: true, effort: "medium", webSearch: { maxUses: 15 }, timeoutMs: 300_000, messages: [{ role: "user", content: prompt }] });
  } catch (err) {
    // free tiers without web search (Gemini free, 2026-11-21): read the company's own website instead
    if (!c.website || !/\b(429|404)\b|quota/i.test(err instanceof Error ? err.message : "")) throw err;
    const site = await readSite(c.website);
    // no quota words here: the backlog must not take an unreadable site for "the AI quota is gone"
    if (!site.text) throw new Error(`website could not be read (${(site.why ?? "empty").slice(0, 120)}); web search not available`);
    // no thinking settings: the free models differ in what they accept, and the answer only restates the site
    out = await ask({ maxTokens: 8000, timeoutMs: 90_000, messages: [{ role: "user", content: sitePrompt(c, lang, site, lessons) }] });
  }
  const { r, parsed } = out;
  return { ...parsed, costEur: Math.round(costEur(r.usage) * 10000) / 10000 };
}

/** The company's own pages as plain text (home + an "about" page when linked), for research without web search. */
export async function readSite(website: string, fetchImpl: typeof fetch = fetch): Promise<{ text: string; urls: string[]; why?: string }> {
  // Maps links carry tracking (?utm_source=...): the site itself is the address without query and fragment
  const start = (website.startsWith("http") ? website : `https://${website}`).replace(/[?#].*$/, "");
  let why = "";
  const get = async (url: string) => {
    try {
      // a plain browser request: many small-company sites behind a firewall refuse unknown bots
      const res = await fetchImpl(url, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36", accept: "text/html,application/xhtml+xml", "accept-language": "it,en;q=0.8" }, signal: AbortSignal.timeout(10_000), redirect: "follow" });
      const type = res.headers.get("content-type") ?? "text/html";
      if (!res.ok || !type.includes("html")) {
        why = `${res.ok ? type : `HTTP ${res.status}`} at ${url}`;
        return "";
      }
      return await res.text();
    } catch (err) {
      why = `${err instanceof Error ? err.message : "unreachable"} at ${url}`;
      return "";
    }
  };
  // the listed address, then the plain-http and www variants (old small-company sites often have only one of them)
  let html = "";
  let home = start;
  for (const url of [start, start.replace(/^https:/, "http:"), start.replace(/^(https?:\/\/)(?!www\.)/, "$1www.")].filter((u, i, a) => a.indexOf(u) === i)) {
    html = await get(url);
    if (html) {
      home = url;
      break;
    }
  }
  if (!html) return { text: "", urls: [], why };
  const about = [...html.matchAll(/href=["']([^"'#]+)["']/gi)].map((m) => m[1]).find((h) => /chi-siamo|chisiamo|azienda|about|storia|ueber-uns|uber-uns/i.test(h));
  const aboutUrl = about ? new URL(about, home).toString() : null;
  const more = aboutUrl && aboutUrl !== home ? await get(aboutUrl) : "";
  const plain = (h: string) => h.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  const text = [plain(html).slice(0, 5000), more ? plain(more).slice(0, 3000) : ""].filter(Boolean).join("\n\n---\n\n");
  return { text, urls: [home, ...(more && aboutUrl ? [aboutUrl] : [])] };
}

function sitePrompt(c: { name: string; city?: string; industry: string; country: string }, lang: string, site: { text: string; urls: string[] }, lessons: string[]) {
  return `Below is the text of the website of a small company (${JSON.stringify({ name: c.name, city: c.city, trade: c.industry, country: c.country })}), pages: ${site.urls.join(", ")}.
Use ONLY this text: no outside knowledge, no guesses. Each fact cites the page it came from (one of those URLs).
Write:
- facts (≤ 8): what they do and for whom, services, area, founding year, certifications, team, anything concrete the site says.
- persona: summary ≤ 3 sentences in ${lang}, offers (≤ 6), customers (one line or null), 3 likely pains with the evidence from the text, 3 questions we should ask them. In ${lang}.
- personal: one opening sentence for a first message that refers to a real fact from the site (no flattery, no invented numbers), in ${lang} ("local") and in Persian ("fa").
${lessons.length ? `What we learned about first messages (follow it):${lessons.map((l) => `\n- ${l}`).join("")}\n` : ""}Reply with one JSON object only: {"facts":[{"text":string,"source":{"name":string,"url":string}}],"persona":{"summary":string,"offers":[string],"customers":string|null,"pains":[{"text":string,"why":string}],"questions":[string]},"personal":{"local":string,"fa":string}}

WEBSITE TEXT:
${site.text}`;
}
