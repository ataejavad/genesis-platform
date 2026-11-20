CREATE TABLE "file_blobs" (
	"key" text PRIMARY KEY NOT NULL,
	"bytes" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leases" (
	"name" text PRIMARY KEY NOT NULL,
	"until" timestamp with time zone NOT NULL,
	"holder" text NOT NULL
);
