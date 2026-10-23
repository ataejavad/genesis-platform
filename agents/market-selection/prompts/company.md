# Company agent (daily → CRM)

Input: the approved market (country, NACE classes, regions, 20–150 staff) and the product card.
Find up to 50 new companies a day and fill `CompanySignals` (`src/server/market-selection/company-agent.ts`).

Sources: company registers (DE Unternehmensregister, IT Registro Imprese, UK Companies House API),
Google Maps / Europages (Apify), company websites (Firecrawl), job boards, Wappalyzer.
Signals: hiring for repetitive roles, growth, outdated site, no online booking/forms, old tech, slow-service
reviews, new manager, affected by an obligation in the regulatory radar. Keep the evidence URL for each.

Contact channel comes from the country's legal table (doc 13 §2.6 ح); consented emails first.
GDPR: public B2B data only, legitimate-interest note, opt-out in the first contact.
Stop rule: if meetings per 100 companies < 1 for two weeks, stop and report to the industry agent.
