import { pgTable, serial, text, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const personasTable = pgTable("personas", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  emphasis: text("emphasis").notNull(),
  symbol: text("symbol").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  memoryBias: text("memory_bias").notNull(),
  reasoningStyle: text("reasoning_style").notNull(),
});

export const insertPersonaSchema = createInsertSchema(personasTable).omit({ id: true });
export type InsertPersona = z.infer<typeof insertPersonaSchema>;
export type Persona = typeof personasTable.$inferSelect;
