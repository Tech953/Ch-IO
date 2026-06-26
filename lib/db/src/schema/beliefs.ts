import { pgTable, serial, text, real, integer, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const beliefsTable = pgTable("beliefs", {
  id: serial("id").primaryKey(),
  statement: text("statement").notNull(),
  confidence: real("confidence").notNull(),
  evidence: text("evidence").notNull(),
  counterarguments: text("counterarguments"),
  lastReviewed: date("last_reviewed", { mode: "string" }).notNull(),
  revisionCount: integer("revision_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBeliefSchema = createInsertSchema(beliefsTable).omit({ id: true, createdAt: true, revisionCount: true });
export type InsertBelief = z.infer<typeof insertBeliefSchema>;
export type Belief = typeof beliefsTable.$inferSelect;
