import {
  pgTable,
  serial,
  integer,
  text,
  real,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { engramsTable } from "./engrams";

/**
 * Provenance of a world-model entry — how the engram came to hold it. This tag is
 * load-bearing for trust: it must never be silently lost or relabeled (e.g. a
 * SIMULATED belief must never masquerade as OBSERVED). Changing provenance is only
 * possible by deleting and re-creating an entry.
 */
export const WORLD_MODEL_PROVENANCES = [
  "observed",
  "inferred",
  "remembered",
  "desired",
  "simulated",
] as const;
export type WorldModelProvenance = (typeof WORLD_MODEL_PROVENANCES)[number];

/** Visibility scope. "shared" is stored/displayed now; cross-engram reads land in a later Hub task. */
export const WORLD_MODEL_SCOPES = ["private", "shared"] as const;
export type WorldModelScope = (typeof WORLD_MODEL_SCOPES)[number];

/**
 * A single, persistent belief in an engram's world-model. Each engram reasons from
 * its own stable, inspectable set of these entries, which survive server restarts.
 */
export const engramWorldModelTable = pgTable("engram_world_model", {
  id: serial("id").primaryKey(),
  engramId: integer("engram_id")
    .notNull()
    .references(() => engramsTable.id, { onDelete: "cascade" }),
  /** One of WORLD_MODEL_PROVENANCES — immutable after creation. */
  provenance: text("provenance").notNull(),
  content: text("content").notNull(),
  /** 0..1 — how strongly the engram holds this. */
  confidence: real("confidence").notNull(),
  /** One of WORLD_MODEL_SCOPES. */
  scope: text("scope").notNull().default("private"),
  /** Where the entry originated, e.g. "chat:42", "engine", "manual". */
  source: text("source"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEngramWorldModelSchema = createInsertSchema(
  engramWorldModelTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEngramWorldModelEntry = z.infer<
  typeof insertEngramWorldModelSchema
>;
export type EngramWorldModelEntry = typeof engramWorldModelTable.$inferSelect;
export type NewEngramWorldModelEntry = typeof engramWorldModelTable.$inferInsert;
