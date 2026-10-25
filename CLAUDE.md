# Rules for agents working in this repository

- Read `README.md` first. The product design lives in the project's `business-plan/15-web-app-design.md`.
- Modular monolith: business logic goes in `src/server/<module>.ts`, takes `db` as its first argument, and is called from routes, server actions and the worker. Routes stay thin.
- Every state change that other parts of the company care about emits an event with `emit()` **in the same transaction**, and writes `audit()`.
- Nothing public changes without an approval. Agents write drafts through the API with scoped keys; they never write to the database directly.
- Private (customer) tables must carry `org_id`; RLS policies arrive with the customer portal (slice D).
- Content and data live in Postgres; code, prompts and templates live in Git.
- Schema changes: edit `src/db/schema.ts`, run `npm run db:generate -- --name <what>`, commit the SQL in `drizzle/`.
- Before pushing: `npm run lint`, `npm run audit:process`, `npm test` (needs `TEST_DATABASE_URL`), `npm run build`.
- **Gap check is part of every build step's definition of done.** Update `src/config/process-map.ts` for every new event, handoff,
  manual step or promise (SLA); walk each relationship the step touches (customer, partner, agents, founder, money, data) and ask
  for every step: what triggers it, who does it, who is told, what happens if nobody acts. A person's step with a promise needs a
  watcher (`src/server/ops-watch.ts` or a cockpit list). Run `npm run audit:process` and report the new gaps it lists; never wait for
  Javad to find them.
- The cockpit UI is English (Javad's choice); customer and partner portals are multilingual. Public site text comes from content and per-language dictionaries, not hard-coded strings.
