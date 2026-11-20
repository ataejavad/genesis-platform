CREATE TABLE "checkups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"industry" text NOT NULL,
	"country" text NOT NULL,
	"locale" text NOT NULL,
	"entrance" text NOT NULL,
	"source" text,
	"answers" jsonb NOT NULL,
	"report" jsonb NOT NULL,
	"total_eur" integer NOT NULL,
	"lead_id" uuid,
	"unlocked_at" timestamp with time zone,
	"call_requested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "checkups" ADD CONSTRAINT "checkups_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkups" ADD CONSTRAINT "checkups_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkups_created_idx" ON "checkups" USING btree ("created_at");