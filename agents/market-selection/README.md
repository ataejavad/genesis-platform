# Market-selection agents (Genesis stage 0)

Design: `business-plan/13-categories-and-machine.md` §2.6 (project files). Rule (Javad, 2026-10-23):
the chain has one output — **the highest-potential customers who actually buy**. If picked companies
don't buy, the diagnostic funnel (`src/server/market-selection/funnel.ts`) says which step to fix.

```
 manual mode: Javad sets country/industry ─┐
 auto mode:   agents look for the market gap ┤
                                           ▼
 1 country (quarterly) ─► Javad ─► 2 industry (monthly) ─► Javad ─► 3 company (daily) ─► CRM
        ▲                              ▲                                   │
        │           4 regulatory radar (weekly) feeds "new regulation"     │
        └──────── monthly learning job: real sales → weight proposals ◄────┘
```

| Agent | Code (scoring, data) | Prompt (research done by Claude) | Runs | KPI · budget cap |
|---|---|---|---|---|
| 1 Country | `country-agent.ts`, `inputs.ts` | `prompts/country.md` | quarterly | % chosen countries with a paying customer in 90 days · 10 €/run |
| 2 Industry | `industry-agent.ts`, `nace.ts` | `prompts/industry-research.md` | monthly | % industries passing the demand test, cost per meeting · 30 €/month |
| 3 Company | `company-agent.ts` | `prompts/company.md` | daily | meetings per 100 companies, cost per lead · 2 €/day, ≤ 50 firms |
| 4 Regulatory radar | `regulations.ts` | `prompts/regulatory-radar.md` | weekly | customers won from obligation-driven offers · 10 €/month |
| Learning | `learning.ts`, `funnel.ts` | – | monthly | predictive accuracy (top vs bottom third buy rate) |

Weights, gates, budgets and funnel targets: `src/server/market-selection/criteria.ts` (one place).

## Run

```bash
npm run agents:market -- all            # needs internet (Eurostat API, free, no key)
npm run agents:market -- industry IT
npm run agents:market -- all --offline  # repeat from saved snapshots
```

Reports land in `data/market-selection/runs/<date>/`. Until n8n is on the server, GitHub Actions
(`.github/workflows/market-selection.yml`) runs it monthly and commits the reports.

## Plugging into n8n later

Each agent is a plain function (`runCountryAgent(fetcher)`, `runIndustryAgent(fetcher, "DE")`, `dailyList(...)`)
so n8n can call it through a small API route, and the research prompts run through the Claude API with the
budget caps above. Results go to Javad through the approval queue (cockpit / Telegram), never straight to action.
