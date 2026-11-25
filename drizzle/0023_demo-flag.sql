ALTER TABLE "orders" ADD COLUMN "demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Mark existing demo/test data (seed scripts, QA runs) with the same rule as src/server/demo.ts isDemo().
UPDATE "organizations" SET "demo" = true WHERE "kind" <> 'internal' AND ("name" ~* '\(demo\)|^\s*(qa\s+)?test\y'
  OR "id" IN (SELECT m."org_id" FROM "memberships" m JOIN "user" u ON u."id" = m."user_id" WHERE u."email" ~* '@local\.test$'));--> statement-breakpoint
UPDATE "partners" SET "demo" = true WHERE "name" ~* '\(demo\)|^\s*(qa\s+)?test\y' OR "email" ~* '@local\.test$';--> statement-breakpoint
UPDATE "orders" SET "demo" = true WHERE "company" ~* '\(demo\)|^\s*(qa\s+)?test\y' OR "email" ~* '@local\.test$'
  OR "org_id" IN (SELECT "id" FROM "organizations" WHERE "demo");
