# Genesis Platform

The company's web application: public site, customer portal, approval cockpit and agent gateway in one codebase.
Design: `business-plan/15-web-app-design.md` (project files). This repository is **slice A**: the skeleton and the approval loop every Genesis agent uses.

```
 agent (n8n / Claude) ──POST /api/v1/drafts──► draft + approval + event (one transaction)
                                                        │
                       worker drains the outbox ◄───────┘
                         ├─► Telegram: message with ✅ / ❌ buttons ──► /api/telegram/webhook ─┐
                         └─► n8n webhook (every event)                                         │
 Javad ── /cockpit (web) ──────────────────────────────────────────────► decide ◄──────────────┘
                                                                          │
                                         published page /{locale}/{slug}, llms.txt, sitemap.xml
```

## What is here

| Path | What |
|---|---|
| `src/db/schema.ts` | Data model: auth, organizations (tenants), markets, content + revisions, approvals, events (outbox), api_keys, agent_runs, audit_log |
| `src/server/content.ts` | Draft → approval → publish. Live text never changes before approval |
| `src/server/api-keys.ts` | Scoped agent keys (only the SHA-256 hash is stored) |
| `src/server/telegram.ts` | Approval messages and button handling |
| `src/worker/` | Outbox dispatcher (Telegram + n8n), retries with backoff |
| `src/server/orchestrator.ts` | Step 9: every recurring job in one list (Rome time), `job_runs` log, retry, run-now; used by the worker and local mode |
| `src/server/daily-report.ts` | Javad's 08:00 brief: verdict, 5 numbers, decisions, stuck items (from ops-watch); Telegram + Cockpit › Today |
| `src/config/agents.ts`, `src/server/agents.ts` | Agent registry: one KPI, target and €/month budget per agent; `runAgent()` gates and meters every Claude call |
| `src/server/improve.ts`, `src/config/experiments.ts` | Improvement loop: experiments, outcomes, z-test, Javad adopts, lessons read by agents |
| `src/server/health.ts`, `retention.ts`, `lead-reminders.ts` | Weekly customer health, monthly results email, story/referral ask, GDPR retention, hub deadline reminders |
| `app/(site)/[locale]/…` | Public pages rendered from published content, with schema.org JSON-LD |
| `app/(internal)/cockpit` | Approval queue for admins |
| `app/api/v1/drafts` | Agent API |
| `app/llms.txt`, `app/sitemap.ts` | Agent and search-engine layer, generated from content |

## Try it on your own computer (no database to install)

Needs Node.js 22 and Git.

```bash
git clone https://github.com/ataejavad/genesis-platform && cd genesis-platform
npm ci
npm run local
```

Opens on http://localhost:3000 with sample pages; the cockpit is http://localhost:3000/cockpit
(`admin@local.test` / `local-demo-password`) and the customer dashboard http://localhost:3000/portal
(demo customer `customer@local.test` / `local-demo-password`), and the partner portal http://localhost:3000/partner
(demo partner `partner@local.test` / `local-demo-password`). Demo projects, orders and a QA item are in the cockpit under Projects and QA queue. Data lives in `./.localdb` (PGlite). Telegram and the worker are off in this mode.

## Run locally with Postgres

```bash
npm ci
cp .env.example .env            # fill DATABASE_URL, BETTER_AUTH_SECRET
npm run db:migrate
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='at-least-12-chars' ADMIN_NAME=You npm run seed
npm run apikey:create -- --name content-agent --scopes content:draft,content:read
npm run dev                     # app on :3000
npm run worker                  # in a second terminal
```

Or with Docker: `docker compose -f docker-compose.yml -f docker-compose.db.yml up --build`.

Tests need a throwaway Postgres: `TEST_DATABASE_URL=postgres://…/genesis_test npm test`.

## Agent API

```bash
curl -X POST $APP_URL/api/v1/drafts \
  -H "Authorization: Bearer gk_…" -H "Content-Type: application/json" \
  -d '{"locale":"de-de","slug":"glass/ai-quotes","title":"…","summary":"…","body":"markdown"}'
# → 201 {"contentId","version","approvalId"}

curl $APP_URL/api/v1/drafts/<approvalId> -H "Authorization: Bearer gk_…"   # needs content:read
# → {"status":"pending|approved|rejected","note",…}
```

Errors are always `{"error":{"code","message"}}` with a matching HTTP status.

## Telegram

1. Create a bot with @BotFather, put the token in `TELEGRAM_BOT_TOKEN`.
2. Send the bot a message, read your chat id and user id from `https://api.telegram.org/bot<token>/getUpdates`, set `TELEGRAM_ADMIN_CHAT_ID` and `TELEGRAM_ADMIN_USER_IDS`.
3. Register the webhook:
   `curl "https://api.telegram.org/bot<token>/setWebhook?url=$APP_URL/api/telegram/webhook&secret_token=$TELEGRAM_WEBHOOK_SECRET&allowed_updates=[\"callback_query\"]"`

## Deploy

Hetzner + Coolify, step by step: [docs/DEPLOY.fa.md](docs/DEPLOY.fa.md).
