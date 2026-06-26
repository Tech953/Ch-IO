import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hieroTable = pgTable("hiero_symbols", {
  id: serial("id").primaryKey(),
  glyph: text("glyph").notNull().unique(),
  name: text("name").notNull(),
  meaning: text("meaning").notNull(),
  category: text("category").notNull(),
  compounds: text("compounds"),
});

export const insertHieroSchema = createInsertSchema(hieroTable).omit({ id: true });
export type InsertHiero = z.infer<typeof insertHieroSchema>;
export type Hiero = typeof hieroTable.$inferSelect;
