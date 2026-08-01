import type { AppDatabase } from "../index";
import { seedExpressions } from "./expressions";
import { seedEngrams } from "./engrams";
import { seedHub } from "./hub";
import { seedFullRezz } from "./full-rezz";

export { seedExpressions, seedEngrams, seedHub, seedFullRezz };

/**
 * Run every idempotent seed in dependency order: reference expressions, engram
 * personas, Hub spaces (which backfills engram presence), then the locked Full
 * Rezz archive. Safe to run on every launch — each seed uses `onConflictDoNothing`.
 */
export async function seedAll(db: AppDatabase): Promise<{
  expressions: { inserted: number; total: number };
  engrams: { inserted: number; total: number };
  hub: { spacesInserted: number; spacesTotal: number; placed: number };
  fullRezz: { engramInserted: boolean; conversationId: number | null; messagesInserted: number };
}> {
  const expressions = await seedExpressions(db);
  const engrams = await seedEngrams(db);
  const hub = await seedHub(db);
  const fullRezz = await seedFullRezz(db);
  return { expressions, engrams, hub, fullRezz };
}
