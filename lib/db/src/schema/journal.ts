import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const journalTable = pgTable("journal", {
  id: serial("id").primaryKey(),
  event: text("event").notNull(),
  confidence: real("confidence").notNull(),
  reflection: text("reflection").notNull(),
  actionItems: text("action_items").notNull(),
  outcome: text("outcome"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertJournalSchema = createInsertSchema(journalTable).omit({ id: true, createdAt: true });
export type InsertJournal = z.infer<typeof insertJournalSchema>;
export type Journal = typeof journalTable.$inferSelect;
