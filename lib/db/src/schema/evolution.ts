import { pgTable, serial, text, real, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const evolutionTable = pgTable("evolution", {
  id: serial("id").primaryKey(),
  revision: integer("revision").notNull(),
  trigger: text("trigger").notNull(),
  description: text("description").notNull(),
  evidenceConsidered: text("evidence_considered"),
  confidence: real("confidence").notNull(),
  expectedImpact: text("expected_impact"),
  validationOutcome: text("validation_outcome"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEvolutionSchema = createInsertSchema(evolutionTable).omit({ id: true, createdAt: true });
export type InsertEvolution = z.infer<typeof insertEvolutionSchema>;
export type Evolution = typeof evolutionTable.$inferSelect;
