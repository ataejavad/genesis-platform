CREATE TABLE "phone_asks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"subject_id" text NOT NULL,
	"fingerprint" text NOT NULL,
	"message_id" text,
	"status" text DEFAULT 'sent' NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "phone_asks_subject_idx" ON "phone_asks" USING btree ("kind","subject_id","fingerprint");--> statement-breakpoint
CREATE INDEX "phone_asks_status_idx" ON "phone_asks" USING btree ("status");