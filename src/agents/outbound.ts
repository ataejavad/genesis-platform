import type { CompanySearch } from "@/providers/company-search";
import type { PeopleSearch } from "@/providers/people-search";
import { scoreCompany } from "@/server/market-selection/company-agent";
import { type Found, toSignals } from "./company-finder";
import type { CompanyResearch } from "./company-research";

/*
 * One outbound run (doc 15 §6ب گام ۴), shared by the cockpit button / server (src/server/outbound-run.ts) and the
 * script (scripts/outbound.ts). find → score → decision makers → research → save. Where each company is saved
 * (the CRM API, or the CRM module from the cockpit) and whether research may spend are the caller's choice.
 * Searches and research run a few at a time, and a time budget keeps a run inside one hosted request: past it,
 * the remaining companies get the template opening line instead of research.
 */

export type Target = { industry: string; country: string; nace: string; language: string; searches: string[]; regions: string[]; decisionMakerTitles: string[] };
export type Contact = { name?: string; role?: string; email?: string; phone?: string; linkedinUrl?: string; source: string; legalBasis?: string; basisSource?: string };
export type Imported = Found & { industry?: string; contacts?: Omit<Contact, "source">[] };
export type SaveResult = { ok: boolean; duplicate?: boolean; touches?: number; error?: string };

export type OutboundDeps = {
  finder: CompanySearch | null;
  people: PeopleSearch | null;
  /** null = research off (no AI model with web search, agent switched off or over budget) */
  research: null | { lessons: string[]; run: (c: { name: string; website?: string; city?: string; industry: string; country: string; signals: Record<string, unknown> }, lessons: string[]) => Promise<CompanyResearch> };
  researchProvider?: string;
  /** filter ids Javad paused in Cockpit › Markets */
  paused: string[];
  save: (body: Record<string, unknown>) => Promise<SaveResult>;
  log?: (line: string) => void;
};

export type OutboundOptions = { limit: number; regions?: string[]; imported?: Imported[]; dry?: boolean; deadline?: number; concurrency?: number };

export type RunCompany = { name: string; city?: string; website?: string; phone?: string; score: number; status: "added" | "duplicate" | "failed" | "dry"; touches?: number; researched: boolean; error?: string };
export type RunSummary = { found: number; kept: number; added: number; duplicates: number; failed: number; researched: number; costEur: number; skipped: string[]; companies: RunCompany[] };

const pausedId = (t: Target) => `filter:${t.country.toUpperCase()}:${t.nace.slice(0, 3).toUpperCase()}`;

/** Runs `fn` over `items`, `n` at a time, keeping the order of the results. */
export async function pool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

export async function runOutbound(targets: Target[], deps: OutboundDeps, o: OutboundOptions): Promise<RunSummary> {
  const log = deps.log ?? (() => undefined);
  const n = o.concurrency ?? 4;
  const late = () => o.deadline !== undefined && Date.now() > o.deadline;
  const sum: RunSummary = { found: 0, kept: 0, added: 0, duplicates: 0, failed: 0, researched: 0, costEur: 0, skipped: [], companies: [] };
  for (const t of targets) {
    if (deps.paused.includes(pausedId(t))) {
      sum.skipped.push(`${t.industry}-${t.country}: filter ${t.nace.slice(0, 3)} paused in the cockpit`);
      continue;
    }
    let found: Imported[] = [];
    let spent = 0;
    if (o.imported) {
      found = o.imported.filter((c) => (c.industry ?? t.industry) === t.industry);
    } else if (deps.finder) {
      const finder = deps.finder;
      const regions = o.regions?.length ? t.regions.filter((r) => o.regions!.includes(r)) : t.regions;
      const queries = t.searches.flatMap((term) => regions.map((region) => ({ term, region })));
      // twice what we keep: the scorer drops the weak ones and duplicates across searches
      const per = Math.max(5, Math.ceil((o.limit * 2) / Math.max(1, queries.length)));
      const lists = await pool(queries, n, async (q) => {
        try {
          const places = await finder.search({ ...q, country: t.country, max: per });
          spent += places.length * finder.eurPerResult;
          return places.filter((p) => !p.closed).map((p) => toSignals(p, { nace: t.nace, region: q.region }));
        } catch (err) {
          log(`   ${q.term} / ${q.region}: ${(err as Error).message}`);
          return [];
        }
      });
      found = lists.flat();
    } else {
      sum.skipped.push(`${t.industry}-${t.country}: no company-search provider key and no import file`);
      continue;
    }
    const seen = new Set<string>();
    const best = found
      .filter((c) => {
        const k = (c.website ?? c.name).toLowerCase();
        return !seen.has(k) && Boolean(seen.add(k));
      })
      .map((c) => ({ c, ...scoreCompany({ ...c, nace: c.nace ?? t.nace }, { nace: [t.nace.split(".")[0]], regions: t.regions }) }))
      .filter((x) => x.criterionScores.fit >= 5)
      .sort((a, b) => b.total - a.total)
      .slice(0, o.limit);
    sum.found += found.length;
    sum.kept += best.length;
    sum.costEur += spent;
    log(`${t.industry}-${t.country}: ${found.length} found, ${best.length} kept`);

    const rows = await pool(best, n, async ({ c, total, criterionScores }): Promise<RunCompany> => {
      // the whole finder run is spread over the companies we keep: that is what finding one really cost
      let cost = best.length ? spent / best.length : 0;
      const contacts: Contact[] = (c.contacts ?? []).map((x) => ({ ...x, source: o.imported ? "list" : "manual" }));
      const domain = c.website?.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
      if (!contacts.length && deps.people && domain && !late()) {
        try {
          contacts.push(...(await deps.people.find(domain, t.decisionMakerTitles)).slice(0, 4));
        } catch (err) {
          log(`   ${c.name}: ${deps.people.provider} ${(err as Error).message}`);
        }
      }
      // no named person yet: the owner's role and the listed phone; the LinkedIn task opens a people search
      if (!contacts.length) contacts.push({ role: t.decisionMakerTitles[0], phone: c.phone, source: "maps" });
      let research: CompanyResearch | null = null;
      if (deps.research && !late()) {
        try {
          research = await deps.research.run({ name: c.name, website: c.website, city: c.city, industry: t.industry, country: t.country, signals: c as unknown as Record<string, unknown> }, deps.research.lessons);
          cost += research.costEur;
        } catch (err) {
          log(`   ${c.name}: research ${(err as Error).message}`);
        }
      }
      const signals = { ...c, seenAt: new Date().toISOString().slice(0, 10) } as Record<string, unknown>;
      for (const k of ["name", "website", "phone", "nace", "region", "city", "contacts", "industry"]) delete signals[k];
      const base = { name: c.name, city: c.city, website: c.website, phone: c.phone, score: Math.round(total * 10) / 10, researched: Boolean(research) };
      if (research) sum.costEur += research.costEur;
      if (o.dry) return { ...base, status: "dry" };
      const body = {
        name: c.name, website: c.website, phone: c.phone, industry: t.industry, country: t.country, region: c.region, city: c.city, nace: c.nace ?? t.nace,
        staff: c.staff, source: o.imported ? "import" : "maps", signals, score: total, criterionScores, contacts,
        ...(research ? { page: { facts: research.facts, persona: research.persona }, personal: research.personal } : {}),
        cost: { eur: Math.round(cost * 10000) / 10000, meta: { finder: o.imported ? "import" : deps.finder?.provider, people: deps.people?.provider ?? null, research: research ? (deps.researchProvider ?? "ai") : null } },
      };
      const r = await deps.save(body).catch((err: unknown) => ({ ok: false, error: err instanceof Error ? err.message : "failed" }) as SaveResult);
      return { ...base, status: !r.ok ? "failed" : r.duplicate ? "duplicate" : "added", touches: r.touches, error: r.error };
    });
    for (const r of rows) {
      sum.companies.push(r);
      if (r.status === "added") sum.added++;
      if (r.status === "duplicate") sum.duplicates++;
      if (r.status === "failed") sum.failed++;
      if (r.researched) sum.researched++;
      log(`   ${r.name}: ${r.status}${r.touches !== undefined ? `, ${r.touches} steps waiting for approval` : ""}${r.error ? ` (${r.error})` : ""}`);
    }
  }
  sum.costEur = Math.round(sum.costEur * 100) / 100;
  return sum;
}
