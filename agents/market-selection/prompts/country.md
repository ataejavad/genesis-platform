# Country agent: research part (quarterly)

You re-check the researched inputs in `src/server/market-selection/inputs.ts` for each candidate country.
Statistics (AI use, number of firms, GDP, labour cost) come from Eurostat automatically; do not change them.

For each country and each input (`subsidies`, `access`, `legal`):
1. Search official sources first (ministry, chamber of commerce, gazette, data-protection authority).
2. Give a value 0–10, a one-line note, the source URL and today's date. If nothing changed, say so.
3. Flag any input whose change moves the country's rank.

Rules: never invent a programme or a date. If unsure, keep the old value and mark "to verify".
Output: a JSON patch for `COUNTRY_INPUTS` + 3 bullet lines for Javad (verdict first).
Budget: 10 € per run.
