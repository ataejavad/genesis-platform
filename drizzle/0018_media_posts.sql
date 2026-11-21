CREATE TABLE "media_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" text NOT NULL,
	"week" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"theme" text NOT NULL,
	"lang" text NOT NULL,
	"industry" text,
	"country" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"body_fa" text,
	"source_url" text,
	"source_title" text,
	"cta" text DEFAULT 'newsletter' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"scheduled_for" timestamp with time zone,
	"publisher" text,
	"published_ref" text,
	"published_at" timestamp with time zone,
	"recipients" integer DEFAULT 0 NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"note" text,
	"writer" text DEFAULT 'ai' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "media_posts_week_idx" ON "media_posts" USING btree ("week","channel","lang","position");--> statement-breakpoint
CREATE INDEX "media_posts_status_idx" ON "media_posts" USING btree ("status","scheduled_for");