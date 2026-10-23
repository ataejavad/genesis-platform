/*
 * Decision-maker finder: names, roles and LinkedIn profiles of owners/managers, from Apollo.io (free plan:
 * test its coverage of Italian 20–249 staff firms first). Off until APOLLO_API_KEY is set; without it the
 * contact is the role ("Titolare") and the LinkedIn task opens a people search for the company.
 * Emails from Apollo are stored but never count as consent: cold email needs Javad's switch and a legal basis.
 */

export const apolloEnabled = () => Boolean(process.env.APOLLO_API_KEY);

export type Person = { name?: string; role?: string; email?: string; linkedinUrl?: string; source: "apollo" };

export async function findPeople(domain: string, titles: string[], fetchImpl: typeof fetch = fetch): Promise<Person[]> {
  const res = await fetchImpl("https://api.apollo.io/api/v1/mixed_people/search", {
    method: "POST",
    headers: { "x-api-key": process.env.APOLLO_API_KEY!, "content-type": "application/json", "cache-control": "no-cache" },
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
}

/** LinkedIn people search for a company, for the person who sends the invitation by hand. */
export const linkedinSearch = (company: string, role = "titolare") =>
  `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${role} ${company}`)}`;
