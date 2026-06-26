import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const memoriesTable = pgTable("memories", {
  id: serial("id").primaryKey(),
  layer: text("layer").notNull(),
  content: text("content").notNull(),
  confidence: real("confidence").notNull(),
  tags: text("tags"),
  lastAccessed: timestamp("last_accessed", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMemorySchema = createInsertSchema(memoriesTable).omit({ id: true, createdAt: true });
export type InsertMemory = z.infer<typeof insertMemorySchema>;
export type Memory = typeof memoriesTable.$inferSelect;
