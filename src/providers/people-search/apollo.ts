import type { PeopleSearch } from ".";

/** Apollo.io (APOLLO_API_KEY; free plan: test its coverage of Italian 20–249 staff firms first). */
export function apolloPeople(key: string, fetchImpl: typeof fetch = fetch): PeopleSearch {
  return {
    provider: "apollo",
    async find(domain, titles) {
      const res = await fetchImpl("https://api.apollo.io/api/v1/mixed_people/search", {
        method: "POST",
        headers: { "x-api-key": key, "content-type": "application/json", "cache-control": "no-cache" },
        body: JSON.stringify({ q_organization_domains_list: [domain], person_titles: titles, page: 1, per_page: 3 }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new Error(`apollo ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as { people?: { name?: string; title?: string; email?: string; linkedin_url?: string }[] };
      return (body.people ?? []).slice(0, 2).map((p) => ({
        name: p.name,
        role: p.title,
        email: p.email && !p.email.includes("email_not_unlocked") ? p.email : undefined,
        linkedinUrl: p.linkedin_url ?? undefined,
        source: "apollo",
      }));
    },
  };
}
