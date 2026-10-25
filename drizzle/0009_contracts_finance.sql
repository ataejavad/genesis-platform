CREATE TABLE "company_profile" (
	"id" text PRIMARY KEY DEFAULT 'main' NOT NULL,
	"legal_name" text,
	"vat_id" text,
	"tax_code" text,
	"address" text,
	"country" text DEFAULT 'IT' NOT NULL,
	"iban" text,
	"bic" text,
	"email" text,
	"registered" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"org_id" uuid,
	"partner_id" uuid,
	"order_id" uuid,
	"jurisdiction" text NOT NULL,
	"language" text NOT NULL,
	"template_version" text NOT NULL,
	"reviewed" boolean DEFAULT false NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"onerous" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"amount_eur" integer DEFAULT 0 NOT NULL,
	"monthly_eur" integer DEFAULT 0 NOT NULL,
	"deposit_eur" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"approved_by" text,
	"signer_name" text,
	"signer_email" text,
	"evidence" jsonb,
	"signed_at" timestamp with time zone,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"contract_id" uuid,
	"order_id" uuid,
	"project_id" uuid,
	"milestone_id" uuid,
	"subscription_id" uuid,
	"period" text,
	"title" text NOT NULL,
	"net_eur" numeric(12, 2) NOT NULL,
	"vat_rate" numeric(5, 2) NOT NULL,
	"vat_eur" numeric(12, 2) NOT NULL,
	"total_eur" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"vat_note" text,
	"reference" text NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"number" text,
	"due_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"issued_at" timestamp with time zone,
	"reminder_level" integer DEFAULT 0 NOT NULL,
	"provider" text,
	"provider_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_reference_unique" UNIQUE("reference"),
	CONSTRAINT "invoices_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audience" text NOT NULL,
	"org_id" uuid,
	"partner_id" uuid,
	"email" text NOT NULL,
	"locale" text NOT NULL,
	"template" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"kind" text DEFAULT 'transactional' NOT NULL,
	"unsubscribe_url" text,
	"event_id" integer,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"step" text NOT NULL,
	"code_hash" text NOT NULL,
	"email" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "contract_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "deposit_eur" integer;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "iban" text;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "billing_name" text;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite_tokens" ADD CONSTRAINT "invite_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature_codes" ADD CONSTRAINT "signature_codes_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contracts_org_idx" ON "contracts" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "contracts_partner_idx" ON "contracts" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "invoices_org_idx" ON "invoices" USING btree ("org_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_sub_period_idx" ON "invoices" USING btree ("subscription_id","period");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_milestone_idx" ON "invoices" USING btree ("milestone_id");--> statement-breakpoint
CREATE INDEX "notifications_status_idx" ON "notifications" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_event_idx" ON "notifications" USING btree ("event_id","template","email");