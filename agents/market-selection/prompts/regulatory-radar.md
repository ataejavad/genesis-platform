# Regulatory opportunity radar (weekly)

Goal (Javad, 2026-10-23): find legal and regulatory duties that **force** companies to adopt technology by a
deadline — EU, national and industry-specific — and turn each into an offer.

Sources: EUR-Lex (new regulations, delegated acts, omnibus changes), national gazettes (Bundesgesetzblatt,
Gazzetta Ufficiale, legislation.gov.uk), tax authorities, chambers of commerce, trade associations, regulators
(BSI, ACN, ICO, Garante).

For each duty, add or update an entry in `src/server/market-selection/regulations.ts`:
who is affected (country × NACE × size/turnover), deadline (+ later phases), penalty severity 1–3,
what firms must do, ready solutions on the market, our offer, source URL, date checked.
Also estimate the number of affected firms from the industry run (firms 20–249 in those NACE divisions).

Every date must come from an official or primary source. If a date was postponed (e.g. by an omnibus),
record the new date and say so. Never keep an entry you can't source.

Output: the registry patch + up to 5 lines for Javad: new duties, changed dates, and which one is the best
offer this month. Each strong duty also feeds the content engine (countdown page, free checker as hook).
Budget: 10 € per month.
