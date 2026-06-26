import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { engramsTable } from "./engrams";
import { hubSpacesTable } from "./hub-spaces";

/** Whether an engram is awake/acting in its space, or visibly at rest (quiescence). */
export const PRESENCE_STATUSES = ["active", "resting"] as const;
export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];

/**
 * An engram's current location in the Hub. One row per engram (engram_id UNIQUE)
 * so it has a single persistent presence that survives restarts. Movement history
 * lives in hub_activity_log, not here.
 */
export const engramPresenceTable = pgTable(
  "engram_presence",
  {
    id: serial("id").primaryKey(),
    engramId: integer("engram_id")
      .notNull()
      .unique()
      .references(() => engramsTable.id, { onDelete: "cascade" }),
    spaceId: integer("space_id")
      .notNull()
      .references(() => hubSpacesTable.id),
    /** One of PRESENCE_STATUSES — derived from the space the engram is in. */
    status: text("status").notNull().default("active"),
    note: text("note"),
    /** When the engram entered its current space. */
    enteredAt: timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("engram_presence_space_idx").on(t.spaceId)],
);

export const insertEngramPresenceSchema = createInsertSchema(engramPresenceTable).omit({
  id: true,
  enteredAt: true,
  updatedAt: true,
});
export type InsertEngramPresence = z.infer<typeof insertEngramPresenceSchema>;
export type EngramPresence = typeof engramPresenceTable.$inferSelect;
export type NewEngramPresence = typeof engramPresenceTable.$inferInsert;
