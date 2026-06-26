import { pgTable, serial, text, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const initiativeTable = pgTable("initiative", {
  id: serial("id").primaryKey(),
  trigger: text("trigger").notNull(),
  message: text("message").notNull(),
  importanceScore: real("importance_score").notNull(),
  confidenceScore: real("confidence_score").notNull(),
  noveltyScore: real("novelty_score").notNull(),
  overallScore: real("overall_score").notNull(),
  wasDelivered: boolean("was_delivered").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInitiativeSchema = createInsertSchema(initiativeTable).omit({ id: true, createdAt: true });
export type InsertInitiative = z.infer<typeof insertInitiativeSchema>;
export type Initiative = typeof initiativeTable.$inferSelect;
