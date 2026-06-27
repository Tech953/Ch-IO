CREATE TABLE "engram_artifact_blobs" (
	"artifact_id" integer PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engram_artifacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"engram_id" integer NOT NULL,
	"conversation_id" integer,
	"trigger" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"provider" text,
	"mime_type" text,
	"filename" text,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"summary" text,
	"error" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "engram_artifact_blobs" ADD CONSTRAINT "engram_artifact_blobs_artifact_id_engram_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."engram_artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engram_artifacts" ADD CONSTRAINT "engram_artifacts_engram_id_engrams_id_fk" FOREIGN KEY ("engram_id") REFERENCES "public"."engrams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engram_artifacts" ADD CONSTRAINT "engram_artifacts_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "engram_artifacts_engram_idx" ON "engram_artifacts" USING btree ("engram_id");--> statement-breakpoint
CREATE INDEX "engram_artifacts_status_idx" ON "engram_artifacts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "engram_artifacts_conversation_idx" ON "engram_artifacts" USING btree ("conversation_id");