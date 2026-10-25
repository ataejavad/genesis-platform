CREATE TABLE "switches" (
	"id" text PRIMARY KEY NOT NULL,
	"enabled" boolean NOT NULL,
	"note" text,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
