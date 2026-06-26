CREATE TABLE "personality" (
	"id" serial PRIMARY KEY NOT NULL,
	"curiosity" real DEFAULT 0.82 NOT NULL,
	"humor" real DEFAULT 0.31 NOT NULL,
	"stoicism" real DEFAULT 0.9 NOT NULL,
	"empathy" real DEFAULT 0.84 NOT NULL,
	"formality" real DEFAULT 0.65 NOT NULL,
	"skepticism" real DEFAULT 0.77 NOT NULL,
	"creativity" real DEFAULT 0.59 NOT NULL,
	"initiative" real DEFAULT 0.55 NOT NULL,
	"precision" real DEFAULT 0.88 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" serial PRIMARY KEY NOT NULL,
	"layer" text NOT NULL,
	"content" text NOT NULL,
	"confidence" real NOT NULL,
	"tags" text,
	"last_accessed" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal" (
	"id" serial PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"confidence" real NOT NULL,
	"reflection" text NOT NULL,
	"action_items" text NOT NULL,
	"outcome" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "personas" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"emphasis" text NOT NULL,
	"symbol" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"memory_bias" text NOT NULL,
	"reasoning_style" text NOT NULL,
	CONSTRAINT "personas_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "beliefs" (
	"id" serial PRIMARY KEY NOT NULL,
	"statement" text NOT NULL,
	"confidence" real NOT NULL,
	"evidence" text NOT NULL,
	"counterarguments" text,
	"last_reviewed" date NOT NULL,
	"revision_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evolution" (
	"id" serial PRIMARY KEY NOT NULL,
	"revision" integer NOT NULL,
	"trigger" text NOT NULL,
	"description" text NOT NULL,
	"evidence_considered" text,
	"confidence" real NOT NULL,
	"expected_impact" text,
	"validation_outcome" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "initiative" (
	"id" serial PRIMARY KEY NOT NULL,
	"trigger" text NOT NULL,
	"message" text NOT NULL,
	"importance_score" real NOT NULL,
	"confidence_score" real NOT NULL,
	"novelty_score" real NOT NULL,
	"overall_score" real NOT NULL,
	"was_delivered" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hiero_symbols" (
	"id" serial PRIMARY KEY NOT NULL,
	"glyph" text NOT NULL,
	"name" text NOT NULL,
	"meaning" text NOT NULL,
	"category" text NOT NULL,
	"compounds" text,
	CONSTRAINT "hiero_symbols_glyph_unique" UNIQUE("glyph")
);
--> statement-breakpoint
CREATE TABLE "expressions" (
	"id" serial PRIMARY KEY NOT NULL,
	"glyph" text NOT NULL,
	"name" text NOT NULL,
	"family" text NOT NULL,
	"eyes" text NOT NULL,
	"mouth" text NOT NULL,
	"gesture" text,
	"valence" text NOT NULL,
	"arousal" text NOT NULL,
	"intimacy" integer DEFAULT 0 NOT NULL,
	"cognitive_role" text,
	"notes" text NOT NULL,
	CONSTRAINT "expressions_glyph_unique" UNIQUE("glyph")
);
--> statement-breakpoint
CREATE TABLE "engrams" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"symbol" text NOT NULL,
	"origin" text NOT NULL,
	"voice_profile" jsonb NOT NULL,
	"emotional_baseline" jsonb NOT NULL,
	"environment_anchor" jsonb NOT NULL,
	"memory_seed" jsonb NOT NULL,
	"guardrails" jsonb NOT NULL,
	"drives" jsonb NOT NULL,
	"focus_themes" jsonb NOT NULL,
	"autonomy_enabled" boolean DEFAULT false NOT NULL,
	"tick_cadence_seconds" integer DEFAULT 60 NOT NULL,
	"initiation_threshold" real DEFAULT 0.6 NOT NULL,
	"mode" text DEFAULT 'full_bounded' NOT NULL,
	"human_contact_enabled" boolean DEFAULT true NOT NULL,
	"simulation_enabled" boolean DEFAULT true NOT NULL,
	"drive_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"current_mood" text,
	"last_tick_at" timestamp with time zone,
	"last_transmission_at" timestamp with time zone,
	"backoff_until" timestamp with time zone,
	"is_chat_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "engrams_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "engram_transmissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"engram_id" integer NOT NULL,
	"kind" text NOT NULL,
	"drive" text NOT NULL,
	"content" text NOT NULL,
	"mood" text,
	"importance_score" real NOT NULL,
	"confidence_score" real NOT NULL,
	"novelty_score" real NOT NULL,
	"overall_score" real NOT NULL,
	"was_delivered" boolean DEFAULT true NOT NULL,
	"seen" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engram_inquiries" (
	"id" serial PRIMARY KEY NOT NULL,
	"engram_id" integer NOT NULL,
	"kind" text NOT NULL,
	"question" text NOT NULL,
	"response" text NOT NULL,
	"config_delta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engram_world_model" (
	"id" serial PRIMARY KEY NOT NULL,
	"engram_id" integer NOT NULL,
	"provenance" text NOT NULL,
	"content" text NOT NULL,
	"confidence" real NOT NULL,
	"scope" text DEFAULT 'private' NOT NULL,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engram_simulation_steps" (
	"id" serial PRIMARY KEY NOT NULL,
	"simulation_id" integer NOT NULL,
	"step_number" integer NOT NULL,
	"narrative" text NOT NULL,
	"world_model_entry_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engram_simulations" (
	"id" serial PRIMARY KEY NOT NULL,
	"engram_id" integer NOT NULL,
	"space_id" integer NOT NULL,
	"premise" text NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"max_steps" integer DEFAULT 5 NOT NULL,
	"step_cooldown_seconds" integer DEFAULT 360 NOT NULL,
	"last_stepped_at" timestamp with time zone,
	"exit_summary" text,
	"started_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"engram_id" integer NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"modality" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"summary" text,
	"commentary" text,
	"transcript" text,
	"error" text,
	"observation_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_blobs" (
	"asset_id" integer PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_id" integer NOT NULL,
	"world_model_entry_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_spaces" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"description" text NOT NULL,
	"visibility_scope" text NOT NULL,
	"action_scope" text NOT NULL,
	"logged" boolean DEFAULT true NOT NULL,
	"allows_initiative" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"ambient" text,
	"accent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hub_spaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "engram_presence" (
	"id" serial PRIMARY KEY NOT NULL,
	"engram_id" integer NOT NULL,
	"space_id" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"note" text,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "engram_presence_engram_id_unique" UNIQUE("engram_id")
);
--> statement-breakpoint
CREATE TABLE "hub_activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"space_id" integer NOT NULL,
	"engram_id" integer,
	"kind" text NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hub_controls" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"quiet_mode" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engram_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_engram_id" integer NOT NULL,
	"to_engram_id" integer,
	"space_id" integer,
	"channel" text NOT NULL,
	"priority" text NOT NULL,
	"status" text NOT NULL,
	"content" text NOT NULL,
	"reason" text,
	"seen" boolean DEFAULT false NOT NULL,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"mode" text DEFAULT 'companion' NOT NULL,
	"persona_name" text,
	"custom_engram" text,
	"engram_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "engram_transmissions" ADD CONSTRAINT "engram_transmissions_engram_id_engrams_id_fk" FOREIGN KEY ("engram_id") REFERENCES "public"."engrams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engram_inquiries" ADD CONSTRAINT "engram_inquiries_engram_id_engrams_id_fk" FOREIGN KEY ("engram_id") REFERENCES "public"."engrams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engram_world_model" ADD CONSTRAINT "engram_world_model_engram_id_engrams_id_fk" FOREIGN KEY ("engram_id") REFERENCES "public"."engrams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engram_simulation_steps" ADD CONSTRAINT "engram_simulation_steps_simulation_id_engram_simulations_id_fk" FOREIGN KEY ("simulation_id") REFERENCES "public"."engram_simulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engram_simulation_steps" ADD CONSTRAINT "engram_simulation_steps_world_model_entry_id_engram_world_model_id_fk" FOREIGN KEY ("world_model_entry_id") REFERENCES "public"."engram_world_model"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engram_simulations" ADD CONSTRAINT "engram_simulations_engram_id_engrams_id_fk" FOREIGN KEY ("engram_id") REFERENCES "public"."engrams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engram_simulations" ADD CONSTRAINT "engram_simulations_space_id_hub_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."hub_spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_engram_id_engrams_id_fk" FOREIGN KEY ("engram_id") REFERENCES "public"."engrams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_blobs" ADD CONSTRAINT "media_blobs_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_observations" ADD CONSTRAINT "media_observations_asset_id_media_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."media_assets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_observations" ADD CONSTRAINT "media_observations_world_model_entry_id_engram_world_model_id_fk" FOREIGN KEY ("world_model_entry_id") REFERENCES "public"."engram_world_model"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engram_presence" ADD CONSTRAINT "engram_presence_engram_id_engrams_id_fk" FOREIGN KEY ("engram_id") REFERENCES "public"."engrams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engram_presence" ADD CONSTRAINT "engram_presence_space_id_hub_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."hub_spaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_activity_log" ADD CONSTRAINT "hub_activity_log_space_id_hub_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."hub_spaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hub_activity_log" ADD CONSTRAINT "hub_activity_log_engram_id_engrams_id_fk" FOREIGN KEY ("engram_id") REFERENCES "public"."engrams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engram_messages" ADD CONSTRAINT "engram_messages_from_engram_id_engrams_id_fk" FOREIGN KEY ("from_engram_id") REFERENCES "public"."engrams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engram_messages" ADD CONSTRAINT "engram_messages_to_engram_id_engrams_id_fk" FOREIGN KEY ("to_engram_id") REFERENCES "public"."engrams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engram_messages" ADD CONSTRAINT "engram_messages_space_id_hub_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."hub_spaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_engram_id_engrams_id_fk" FOREIGN KEY ("engram_id") REFERENCES "public"."engrams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "engram_simulation_steps_sim_idx" ON "engram_simulation_steps" USING btree ("simulation_id");--> statement-breakpoint
CREATE INDEX "engram_simulations_engram_idx" ON "engram_simulations" USING btree ("engram_id");--> statement-breakpoint
CREATE INDEX "engram_simulations_status_idx" ON "engram_simulations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "media_assets_engram_idx" ON "media_assets" USING btree ("engram_id");--> statement-breakpoint
CREATE INDEX "media_assets_status_idx" ON "media_assets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "media_observations_asset_idx" ON "media_observations" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "hub_spaces_sort_idx" ON "hub_spaces" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "engram_presence_space_idx" ON "engram_presence" USING btree ("space_id");--> statement-breakpoint
CREATE INDEX "hub_activity_space_created_idx" ON "hub_activity_log" USING btree ("space_id","created_at");--> statement-breakpoint
CREATE INDEX "hub_activity_engram_created_idx" ON "hub_activity_log" USING btree ("engram_id","created_at");--> statement-breakpoint
CREATE INDEX "engram_messages_channel_created_idx" ON "engram_messages" USING btree ("channel","created_at");--> statement-breakpoint
CREATE INDEX "engram_messages_from_created_idx" ON "engram_messages" USING btree ("from_engram_id","created_at");--> statement-breakpoint
CREATE INDEX "engram_messages_to_created_idx" ON "engram_messages" USING btree ("to_engram_id","created_at");--> statement-breakpoint
CREATE INDEX "engram_messages_space_created_idx" ON "engram_messages" USING btree ("space_id","created_at");