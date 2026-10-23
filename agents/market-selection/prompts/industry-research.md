# Industry agent: deep research (monthly, top candidates only)

Input: `data/market-selection/runs/<date>/industry-<CC>.json` (statistics already scored).
Take the top 10 divisions. For each, open it to 4-digit NACE classes and pick the 1–2 classes where
the pain is clearest. Then, for the **top 3 only**, fill the researched criteria (0–10 each, with source):

| Criterion | What to look for |
|---|---|
| manual_work | share of clerical/repetitive roles (EU LFS NACE × ISCO), typical manual processes (APQC) |
| regulation | obligations from the regulatory radar + industry rules not yet in the registry (add them) |
| solutions | ready, proven tools for the main pain; count vendors and case studies in this country's language |
| reachability | trade associations, fairs, directories, decision makers findable |
| competition | integrators/vertical SaaS already selling this to this industry here (low is good) |
| replicability | same pain in other candidate countries / neighbouring classes |

Then write one card per top-3 industry (doc 13 §2.6 د):
1. score + confidence; 2. size (firms 20–249, turnover, margin, growth); 3. main pain in one sentence with a number;
4. **first product**: outcome promised, ready tool, setup + monthly price (hypothesis); 5. **10 sample companies**
(name, size, city, why); 6. risks; 7. demand test: 50 companies, 2 weeks, pass = ≥ 3 meetings.

Rules: public data only, every number with a source, no invented companies. Budget: 30 € per month.
Cold start (Javad, 2026-10-23): the top 2 industries are tested in parallel.
