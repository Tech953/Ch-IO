import {
  pgTable,
  serial,
  integer,
  text,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { engramsTable } from "./engrams";

/** A record of probing or developing an engram through the inquiry system. */
export const engramInquiriesTable = pgTable("engram_inquiries", {
  id: serial("id").primaryKey(),
  engramId: integer("engram_id")
    .notNull()
    .references(() => engramsTable.id, { onDelete: "cascade" }),
  /** "probe" = introspective Q&A (no change); "develop" = guided tuning of the engram. */
  kind: text("kind").notNull(),
  question: text("question").notNull(),
  response: text("response").notNull(),
  /** For "develop": the structured change applied to the engram's config/memory. */
  configDelta: jsonb("config_delta").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEngramInquirySchema = createInsertSchema(engramInquiriesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertEngramInquiry = z.infer<typeof insertEngramInquirySchema>;
export type EngramInquiry = typeof engramInquiriesTable.$inferSelect;
export type NewEngramInquiry = typeof engramInquiriesTable.$inferInsert;
