CREATE TABLE "service_costs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"period" text NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"amount_eur" numeric(10, 2) NOT NULL,
	"source" text NOT NULL,
	"job_id" uuid,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supply_gaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill" text NOT NULL,
	"language" text,
	"country" text,
	"job_id" uuid,
	"post" text NOT NULL,
	"candidates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"invited_at" timestamp with time zone,
	"status" text DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "subscription_id" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "period" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "lost_reason" text;--> statement-breakpoint
ALTER TABLE "prospects" ADD COLUMN "lost_reason" text;--> statement-breakpoint
ALTER TABLE "service_packages" ADD COLUMN "monthly" jsonb DEFAULT '{"tasks":[],"costs":[]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "ends_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "cancel_note" text;--> statement-breakpoint
ALTER TABLE "service_costs" ADD CONSTRAINT "service_costs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_costs" ADD CONSTRAINT "service_costs_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "service_costs_line_idx" ON "service_costs" USING btree ("subscription_id","period","label","source");--> statement-breakpoint
CREATE INDEX "service_costs_org_idx" ON "service_costs" USING btree ("org_id","period");--> statement-breakpoint
CREATE INDEX "supply_gaps_status_idx" ON "supply_gaps" USING btree ("status","skill");