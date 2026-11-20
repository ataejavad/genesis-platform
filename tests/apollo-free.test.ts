import { describe, expect, it } from "vitest";
import { apolloPeople } from "@/providers/people-search/apollo";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

// Free Apollo keys cannot call People Search: the adapter falls back to company id + its top people.
describe("Apollo people finder", () => {
  it("uses People Search when the key allows it", async () => {
    const f = (async () => json({ people: [{ first_name: "Anna", last_name_obfuscated: "R***i", title: "Titolare" }] })) as typeof fetch;
    expect(await apolloPeople("k", f).find("x.it", ["Titolare"])).toEqual([{ name: "Anna R***i", role: "Titolare", email: undefined, linkedinUrl: undefined, source: "apollo" }]);
  });
  it("falls back to enrich + top people on the free plan, wanted roles first", async () => {
    const calls: string[] = [];
    const f = (async (url: string) => {
      calls.push(url.replace("https://api.apollo.io/api/v1/", ""));
      if (url.includes("api_search")) return json({ error: "not accessible on free plan" }, 403);
      if (url.includes("organizations/enrich")) return json({ organization: { id: "org1" } });
      return json({ people: [{ name: "Ugo B", title: "Sales Manager" }, { name: "Marco V", title: "CEO & Founder", email: "email_not_unlocked@domain.com" }, { name: "Lia T", title: "Titolare" }] });
    }) as unknown as typeof fetch;
    const people = await apolloPeople("k", f).find("x.it", ["Titolare", "CEO"]);
    expect(people.map((p) => p.name)).toEqual(["Lia T", "Marco V"]);
    expect(people[1].email).toBeUndefined();
    expect(calls).toEqual(["mixed_people/api_search", "organizations/enrich?domain=x.it", "mixed_people/organization_top_people"]);
  });
});
