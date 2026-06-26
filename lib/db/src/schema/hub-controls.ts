import { pgTable, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/** The fixed primary-key of the single hub_controls row. */
export const HUB_CONTROLS_ID = 1;

/**
 * Global runtime overrides for the autonomy engine — a singleton row (id = 1).
 * `paused` stops ALL engine initiative immediately (engrams still accrue pressure
 * but emit nothing). `quietMode` blocks engram-initiated human contact globally
 * while leaving engram-to-engram conversation untouched. Read once per engine tick
 * and enforced by pure policy before any model call.
 */
export const hubControlsTable = pgTable("hub_controls", {
  id: integer("id").primaryKey().default(HUB_CONTROLS_ID),
  paused: boolean("paused").notNull().default(false),
  quietMode: boolean("quiet_mode").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertHubControlsSchema = createInsertSchema(hubControlsTable).omit({
  updatedAt: true,
});
export type InsertHubControls = z.infer<typeof insertHubControlsSchema>;
export type HubControls = typeof hubControlsTable.$inferSelect;
export type NewHubControls = typeof hubControlsTable.$inferInsert;
