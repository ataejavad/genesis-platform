CREATE TABLE "channel_switches" (
	"country" text NOT NULL,
	"channel" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_switches_country_channel_pk" PRIMARY KEY("country","channel")
);
--> statement-breakpoint
CREATE TABLE "company_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"code" text NOT NULL,
	"locale" text NOT NULL,
	"doc" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"first_viewed_at" timestamp with time zone,
	"last_viewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_pages_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"name" text,
	"role" text,
	"email" text,
	"phone" text,
	"linkedin_url" text,
	"source" text NOT NULL,
	"email_consent" boolean DEFAULT false NOT NULL,
	"legal_basis" text,
	"basis_source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid,
	"channel" text NOT NULL,
	"direction" text NOT NULL,
	"party" text NOT NULL,
	"body" text NOT NULL,
	"author" text,
	"provider_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"website" text,
	"phone" text,
	"industry" text NOT NULL,
	"country" text NOT NULL,
	"region" text,
	"city" text,
	"nace" text,
	"staff" integer,
	"source" text NOT NULL,
	"signals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"score" numeric(5, 1),
	"criterion_scores" jsonb,
	"stage" text DEFAULT 'new' NOT NULL,
	"sequence" text,
	"lead_id" uuid,
	"checkup_id" uuid,
	"rpo_checked_at" timestamp with time zone,
	"rpo_listed" boolean,
	"do_not_contact_reason" text,
	"note" text,
	"contacted_at" timestamp with time zone,
	"replied_at" timestamp with time zone,
	"interested_at" timestamp with time zone,
	"meeting_at" timestamp with time zone,
	"won_at" timestamp with time zone,
	"lost_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "touches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prospect_id" uuid NOT NULL,
	"contact_id" uuid,
	"step" text NOT NULL,
	"position" integer NOT NULL,
	"channel" text NOT NULL,
	"locale" text NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"body_fa" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"blocked_reason" text,
	"due_at" timestamp with time zone NOT NULL,
	"approved_by" text,
	"sent_at" timestamp with time zone,
	"outcome" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "company_pages" ADD CONSTRAINT "company_pages_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox" ADD CONSTRAINT "inbox_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prospects" ADD CONSTRAINT "prospects_checkup_id_checkups_id_fk" FOREIGN KEY ("checkup_id") REFERENCES "public"."checkups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "touches" ADD CONSTRAINT "touches_prospect_id_prospects_id_fk" FOREIGN KEY ("prospect_id") REFERENCES "public"."prospects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "touches" ADD CONSTRAINT "touches_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "company_pages_prospect_idx" ON "company_pages" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "contacts_prospect_idx" ON "contacts" USING btree ("prospect_id");--> statement-breakpoint
CREATE INDEX "inbox_party_idx" ON "inbox" USING btree ("channel","party","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inbox_provider_idx" ON "inbox" USING btree ("channel","provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prospects_key_idx" ON "prospects" USING btree ("country","key");--> statement-breakpoint
CREATE INDEX "prospects_stage_idx" ON "prospects" USING btree ("stage","industry");--> statement-breakpoint
CREATE INDEX "touches_due_idx" ON "touches" USING btree ("status","channel","due_at");--> statement-breakpoint
CREATE INDEX "touches_prospect_idx" ON "touches" USING btree ("prospect_id");