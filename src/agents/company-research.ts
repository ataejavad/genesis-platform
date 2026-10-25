import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { researchedPage } from "@/server/company-page-doc";

/*
 * Company research (research 2026-10-23, Javad: know the customer before the first contact). Claude reads the
 * firm's public footprint on the web and returns: facts with sources, a starter persona of the company, and
 * one personal opening line in the country language plus Persian for Javad. Off until ANTHROPIC_API_KEY is set;
 * then the page is built from the Maps data and the hub research, and the opening line from the signals.
 */

export const researchEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);
const MODEL = "claude-opus-5-5";
// € per million tokens and per search, for the cost of a customer; set from the current price list
const PRICE = { in: Number(process.env.CLAUDE_EUR_PER_MTOK_IN ?? 5), out: Number(process.env.CLAUDE_EUR_PER_MTOK_OUT ?? 25), search: 0.01 };

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

export async function researchCompany(c: { name: string; website?: string; city?: string; industry: string; country: string; signals: Record<string, unknown> }): Promise<CompanyResearch> {
  const client = new Anthropic({ timeout: 300_000, maxRetries: 1 });
  const lang = LANG[c.country] ?? "English";
  const prompt = `Research this small company from public sources before we contact it: ${JSON.stringify({ name: c.name, website: c.website, city: c.city, trade: c.industry, country: c.country })}.
Known signals: ${JSON.stringify(c.signals)}.
Check these sources, as many as give something: ${sourcesFor(c.country).map((x) => `\n- ${x}`).join("")}
Find: what they do and for whom, services, size and revenue band, founding year, recent news, hiring, tenders won, certifications, review themes. Only facts you saw, each with its source URL. No guesses about people's private lives; company facts only.
Then write:
- persona: how this company would describe itself (summary ≤ 3 sentences in ${lang}), offers (≤ 6), customers (one line or null), 3 likely pains with the evidence that suggests each, 3 questions we should ask them. In ${lang}.
- personal: one opening sentence for a first message that refers to a real fact you found (no flattery, no invented numbers), in ${lang} ("local") and in Persian ("fa").
Reply with one JSON object only: {"facts":[{"text":string,"source":{"name":string,"url":string}}],"persona":{"summary":string,"offers":[string],"customers":string|null,"pains":[{"text":string,"why":string}],"questions":[string]},"personal":{"local":string,"fa":string}}`;
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: prompt }];
  let cost = 0;
  for (let turn = 0; turn < 5; turn++) {
    const m = await client.messages
      .stream({ model: MODEL, max_tokens: 16000, thinking: { type: "adaptive" }, output_config: { effort: "medium" }, tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 15 }], messages })
      .finalMessage();
    cost += (m.usage.input_tokens * PRICE.in + m.usage.output_tokens * PRICE.out) / 1e6 + (m.usage.server_tool_use?.web_search_requests ?? 0) * PRICE.search;
    if (m.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: m.content });
      continue;
    }
    if (m.stop_reason === "refusal") throw new Error("research refused");
    const text = m.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const parsed = resultSchema.parse(JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)));
    return { ...parsed, costEur: Math.round(cost * 10000) / 10000 };
  }
  throw new Error("research did not finish");
}
