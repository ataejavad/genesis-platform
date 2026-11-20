ALTER TABLE "milestones" ADD COLUMN "late_notices" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "vat_valid" boolean;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "vat_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "vat_checked_at" timestamp with time zone;