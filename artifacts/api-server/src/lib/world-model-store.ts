import { db } from "@workspace/db";
import {
  engramWorldModelTable,
  type EngramWorldModelEntry,
  type NewEngramWorldModelEntry,
} from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";

/** How many recent entries we pull into prompt context (the summarizer caps further). */
export const WORLD_MODEL_PROMPT_LIMIT = 40;

/** Load an engram's most-recent world-model entries (recency-ordered) for prompt context. */
export async function loadRecentWorldModel(
  engramId: number,
  limit = WORLD_MODEL_PROMPT_LIMIT,
): Promise<EngramWorldModelEntry[]> {
  return db
    .select()
    .from(engramWorldModelTable)
    .where(eq(engramWorldModelTable.engramId, engramId))
    .orderBy(desc(engramWorldModelTable.createdAt))
    .limit(limit);
}

/** Append a single world-model entry. Provenance on a new entry is set once and never changed. */
export async function appendWorldModelEntry(
  entry: NewEngramWorldModelEntry,
): Promise<EngramWorldModelEntry> {
  const [row] = await db.insert(engramWorldModelTable).values(entry).returning();
  return row;
}
