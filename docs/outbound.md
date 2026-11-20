# Outbound machine (step 4)

```
company finder ─► scorer ─► decision-maker ─► company research ─► CRM (page + sequence as drafts)
 (Apify / import)  (fit×need×reach)  (Apollo)   (Claude: facts, persona, line)      │
                                                                                     ▼
              Javad approves in Cockpit › Outbound ─► page goes live ─► sequence runs
                    LinkedIn + calls: tasks for a person · email + AI calls: outbox every 10 min
                    reply / page visit / WhatsApp ─► Telegram alert, sequence stops, (optional) warm call
```

## Run

- Local: `npm run local`, then `npm run agents:outbound -- --industry metal --limit 20` (or `--import list.json`, `--dry`).
- Server: same command daily with `OUTBOUND_AGENT_KEY` (scope `crm:write`); the worker runs the outbox.

## Import format (`--import`)

JSON array; one object per company:

```json
[{ "industry": "metal", "name": "Rossi Srl", "website": "rossi.it", "phone": "+39 030 1234567", "city": "Brescia",
   "region": "Lombardia", "staff": 35, "hiringRepetitiveRoles": true,
   "contacts": [{ "name": "Marco Rossi", "role": "Titolare", "email": "marco@rossi.it",
                  "legalBasis": "consent", "basisSource": "Fiera Lamiera 2026, modulo firmato" }] }]
```

Signals the scorer reads: `hiringRepetitiveRoles`, `affectedByObligation` (radar ids), `growing`, `outdatedWebsite`,
`noOnlineBookingOrForms`, `oldTechStack`, `slowServiceReviews`, `newManager`. A legal basis is only taken from
imported lists, never from an agent.

## Channels and switches

| Channel | Who sends | Default | Before each send |
|---|---|---|---|
| LinkedIn | a person, from the cockpit task (25 invites, 40 messages a day) | on | — |
| Email to consented contacts | outbox (Brevo) | on once the key exists | consent on record |
| Cold email | outbox | **off** (switch per country) | legal basis on the contact |
| Call by a person | a person, with the script | on | Italy: Registro delle Opposizioni checked in the last 15 days |
| AI voice call | Vapi | **off** (switch per country) | legal basis or requested callback; AI disclosure first; Registro |
| Warm call after reply / page visit | a person | **off** (switch per country) | as a call by a person |
| WhatsApp | agent answers inbound messages | on once the key exists | they wrote first |

Risk labels and reasons are in `src/server/outreach-rules.ts` and shown next to each switch.
