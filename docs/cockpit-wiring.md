# Wire into the cockpit at step 10

Every agent and module built before step 10 lands here, so the cockpit ends up as one control room, not a
pile of separate tools. For each item the cockpit needs: status, last run, cost, KPI, on/off, manual run.
Add a line whenever you build something that runs on its own or produces numbers.

| # | Item | Built in | Runs | What the cockpit must show / control | Now |
|---|------|----------|------|--------------------------------------|-----|
| 1 | Market-selection agents (country, industry, radar, report) | Step 1 (PR #2) | GitHub Actions, monthly; output `data/market-selection/runs/<date>/` | Last run, ranking, dropped filters, approve/pause a filter (hard gate), cost | Mock table in Cockpit › Markets |
| 2 | Hub-builder agent | Step 2 | `npm run agents:hubs` on every local start; later on a schedule (weekly) | Last run, check report (dropped/warn/error per hub), pages per locale live vs waiting, manual run, on/off | "Live hubs" table in Cockpit › Markets (live data) |
| 3 | Hub research step (Claude API, web search) | Step 2 | `npm run agents:hubs -- --research`, only when `ANTHROPIC_API_KEY` is set | Tokens and searches per run → € cost per hub, budget cap, auto-stop when a hub's KPI does not pay | Off (no key yet); usage printed to the console only |
| 4 | Hub KPI | Step 2 | — | Opted-in leads per hub per month vs target (from the research file), funnel: views → hook answered → opt-in → confirmed → check-up booked | Leads vs target in "Live hubs"; views and funnel need analytics (PostHog EU) |
| 5 | Leads (`leads` table, `lead.captured` event) | Step 2 | Public hook on each hub | List, export, unsubscribe, consent text per lead, double opt-in state | Stored; no cockpit list yet; confirmation email waits for an email provider (step 4) |
| 6 | Deadline reminders | Step 2 (data) | Planned: daily job, 30 days before each deadline, only to `reminders = true` and confirmed leads | Queue, sent, opened, clicked → check-ups | Not built; needs email provider (step 4) |
| 7 | Hub freshness | Step 2 | Rules in `src/server/hubs.ts` (`MAX_AGE`) | Age per block, stale warnings, "refresh now" | Warnings show in "Live hubs"; per-block table is mock |
| 8 | Demand signals from industries without a hub | Earlier (prototype) | Sign-up, chat, explore "request this industry" | Count per NACE × country → feeds market selection | Mock table in Cockpit › Markets |
| 9 | Agent API keys | Slice A | `npm run apikey:create`; local start makes a fresh `hub-builder (local)` key each run | Keys, scopes, last used, revoke | Cockpit › API (partly mock) |
| 10 | Free check-up engine (`checkups` table; events `checkup.completed`, `checkup.unlocked`, `checkup.call_requested`) | Step 3 | Public: form page `/checkup` and the home chat (same engine) | Funnel per entrance and industry (started → completed → unlocked → call), € found per check-up, lead score, list of call requests with owner and SLA (call within 1 working day) | Funnel table in Cockpit › Markets (live data); "started" needs analytics; call requests are not routed to anyone yet (CRM, step 4) |
| 11 | Check-up questions and savings rules (`data/checkup/<industry>.json`) | Step 3 | Read on every check-up | Version per industry, edit through Git + approval, A/B of questions vs unlock rate | Git only |
| 12 | Check-up advisor (Claude writes a 3-sentence personal summary at unlock) | Step 3 | Only with `ANTHROPIC_API_KEY`; template sentence otherwise | Cost per unlocked report, on/off, sample review | Off (no key yet) |
