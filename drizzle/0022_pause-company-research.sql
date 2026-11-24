-- Javad 2026-11-24: pause the company research engine for now, so the free Gemini quota goes to content and the
-- solutions radar. Turn it back on in Cockpit › Agents (Company research) and Cockpit › Today (job outbound.research).
INSERT INTO "agent_settings" ("agent", "enabled", "note") VALUES ('company-research', false, 'Paused by Javad 2026-11-24: Gemini quota for content + solutions radar')
ON CONFLICT ("agent") DO UPDATE SET "enabled" = false, "note" = EXCLUDED."note", "updated_at" = now();
--> statement-breakpoint
INSERT INTO "switches" ("id", "enabled", "note", "updated_by") VALUES ('job:outbound.research', false, 'Paused by Javad 2026-11-24: Gemini quota for content + solutions radar', 'migration')
ON CONFLICT ("id") DO UPDATE SET "enabled" = false, "note" = EXCLUDED."note", "updated_by" = 'migration', "updated_at" = now();
