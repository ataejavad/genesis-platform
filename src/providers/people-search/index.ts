import type { Env } from "../registry";
import { chosen } from "../registry";
import { apolloPeople } from "./apollo";

/*
 * Decision-maker finder, provider-agnostic. PEOPLE_SEARCH_PROVIDER = apollo | none (auto: apollo with its key).
 * Without one the contact is the role ("Titolare") and a person opens a LinkedIn search for the company.
 * Emails found never count as consent: cold email needs Javad's switch and a legal basis.
 */
export type Person = { name?: string; role?: string; email?: string; linkedinUrl?: string; source: string };

export type PeopleSearch = { provider: string; find: (domain: string, titles: string[]) => Promise<Person[]> };

export function peopleSearchFromEnv(env: Env = process.env, fetchImpl: typeof fetch = fetch): PeopleSearch | null {
  return chosen("people_search", env) === "apollo" && env.APOLLO_API_KEY ? apolloPeople(env.APOLLO_API_KEY, fetchImpl) : null;
}

/** LinkedIn people search for a company, for the person who sends the invitation by hand (a link, not an API). */
export const linkedinSearch = (company: string, role = "titolare") =>
  `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(`${role} ${company}`)}`;
