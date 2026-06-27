ALTER TABLE "media_assets" ALTER COLUMN "engram_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "conversation_id" integer;--> statement-breakpoint
ALTER TABLE "media_assets" ADD COLUMN "context_message_id" integer;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_context_message_id_messages_id_fk" FOREIGN KEY ("context_message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_assets_conversation_idx" ON "media_assets" USING btree ("conversation_id");