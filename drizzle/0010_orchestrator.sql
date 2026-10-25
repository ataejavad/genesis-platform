CREATE TABLE "agent_settings" (
	"agent" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"budget_eur" integer,
	"paused_until" timestamp with time zone,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_health" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"week" text NOT NULL,
	"score" integer NOT NULL,
	"band" text NOT NULL,
	"signals" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiment_subjects" (
	"experiment_id" uuid NOT NULL,
	"subject_id" text NOT NULL,
	"variant" text NOT NULL,
	"success" boolean,
	"guardrail_hit" boolean DEFAULT false NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome_at" timestamp with time zone,
	CONSTRAINT "experiment_subjects_experiment_id_subject_id_pk" PRIMARY KEY("experiment_id","subject_id")
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"area" text NOT NULL,
	"hypothesis" text NOT NULL,
	"metric" text NOT NULL,
	"guardrail" text,
	"variants" jsonb NOT NULL,
	"min_sample" integer DEFAULT 30 NOT NULL,
	"window_days" integer DEFAULT 21 NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"winner" text,
	"result" jsonb,
	"created_by" text NOT NULL,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "experiments_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean,
	"result" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"area" text NOT NULL,
	"text" text NOT NULL,
	"source" text NOT NULL,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"day" text NOT NULL,
	"verdict" text NOT NULL,
	"body" jsonb NOT NULL,
	"text" text NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_runs" ADD COLUMN "ok" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_health" ADD CONSTRAINT "customer_health_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_subjects" ADD CONSTRAINT "experiment_subjects_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_health_org_week_idx" ON "customer_health" USING btree ("org_id","week");--> statement-breakpoint
CREATE INDEX "job_runs_job_idx" ON "job_runs" USING btree ("job","started_at");--> statement-breakpoint
CREATE INDEX "lessons_area_idx" ON "lessons" USING btree ("area","active");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_kind_day_idx" ON "reports" USING btree ("kind","day");--> statement-breakpoint
CREATE INDEX "agent_runs_agent_idx" ON "agent_runs" USING btree ("agent","created_at");