import type { AppDatabase } from "../index";
import { seedExpressions } from "./expressions";
import { seedEngrams } from "./engrams";
import { seedHub } from "./hub";

// seedFullRezz is exported for use by the background post-startup task only.
// It must NOT be called from seedAll() — the 1,331 message inserts would block
// ensureDatabaseReady() and prevent the server port from opening in time.
export { seedExpressions, seedEngrams, seedHub };
export { seedFullRezz } from "./full-rezz";

/**
 * Run every idempotent seed in dependency order: reference expressions, engram
 * personas, then Hub spaces (which backfills engram presence).
 * Full Rezz messages are seeded asynchronously after the server is listening.
 */
export async function seedAll(db: AppDatabase): Promise<{
  expressions: { inserted: number; total: number };
  engrams: { inserted: number; total: number };
  hub: { spacesInserted: number; spacesTotal: number; placed: number };
}> {
  const expressions = await seedExpressions(db);
  const engrams = await seedEngrams(db);
  const hub = await seedHub(db);
  return { expressions, engrams, hub };
}
