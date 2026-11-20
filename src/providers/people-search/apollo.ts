import type { Person, PeopleSearch } from ".";

type ApolloPerson = { name?: string; first_name?: string; last_name?: string; last_name_obfuscated?: string; title?: string; email?: string; linkedin_url?: string };

/**
 * Apollo.io (APOLLO_API_KEY). Paid keys use People API Search (mixed_people/api_search). On the free plan that endpoint is
 * closed, so we fall back to what free keys may call: organizations/enrich (domain -> company id) and
 * mixed_people/organization_top_people (the company's senior people), then keep the roles we asked for first.
 */
export function apolloPeople(key: string, fetchImpl: typeof fetch = fetch): PeopleSearch {
  const call = async (path: string, init: RequestInit = {}) => {
    const res = await fetchImpl(`https://api.apollo.io/api/v1/${path}`, {
      ...init,
      headers: { "x-api-key": key, "content-type": "application/json", "cache-control": "no-cache" },
      signal: AbortSignal.timeout(30_000),
    });
    return { res, text: res.ok ? "" : (await res.text()).slice(0, 200), json: res.ok ? ((await res.json()) as Record<string, unknown>) : {} };
  };
  const toPerson = (p: ApolloPerson): Person => ({
    name: p.name ?? ([p.first_name, p.last_name ?? p.last_name_obfuscated].filter(Boolean).join(" ") || undefined),
    role: p.title,
    email: p.email && !p.email.includes("email_not_unlocked") ? p.email : undefined,
    linkedinUrl: p.linkedin_url ?? undefined,
    source: "apollo",
  });
  return {
    provider: "apollo",
    async find(domain, titles) {
      const search = await call("mixed_people/api_search", { method: "POST", body: JSON.stringify({ q_organization_domains_list: [domain], person_titles: titles, page: 1, per_page: 3 }) });
      if (search.res.ok) return ((search.json.people as ApolloPerson[] | undefined) ?? []).slice(0, 2).map(toPerson);
      if (search.res.status !== 401 && search.res.status !== 403) throw new Error(`apollo ${search.res.status}: ${search.text}`);
      // free plan
      const org = await call(`organizations/enrich?domain=${encodeURIComponent(domain)}`);
      if (!org.res.ok) throw new Error(`apollo enrich ${org.res.status}: ${org.text}`);
      const id = (org.json.organization as { id?: string } | undefined)?.id;
      if (!id) return [];
      const top = await call("mixed_people/organization_top_people", { method: "POST", body: JSON.stringify({ organization_id: id, page: 1, per_page: 10 }) });
      if (!top.res.ok) throw new Error(`apollo top people ${top.res.status}: ${top.text}`);
      const people = (top.json.people as ApolloPerson[] | undefined) ?? [];
      const wanted = titles.map((t) => t.toLowerCase());
      const rank = (p: ApolloPerson) => {
        const i = wanted.findIndex((t) => (p.title ?? "").toLowerCase().includes(t));
        return i === -1 ? wanted.length : i;
      };
      return [...people].sort((a, b) => rank(a) - rank(b)).slice(0, 2).map(toPerson);
    },
  };
}
