import { db } from "@workspace/db";
import { hubControlsTable, HUB_CONTROLS_ID } from "@workspace/db/schema";
import type { HubControls } from "@workspace/db";
import { eq } from "drizzle-orm";
import { publishEvent } from "./events";

/**
 * Load the singleton global-controls row, creating it with defaults on first
 * access. There is exactly one row (id = HUB_CONTROLS_ID).
 */
export async function loadControls(): Promise<HubControls> {
  const [existing] = await db
    .select()
    .from(hubControlsTable)
    .where(eq(hubControlsTable.id, HUB_CONTROLS_ID));
  if (existing) return existing;

  const [created] = await db
    .insert(hubControlsTable)
    .values({ id: HUB_CONTROLS_ID })
    .onConflictDoNothing()
    .returning();
  if (created) return created;

  // Lost an insert race — re-read.
  const [row] = await db
    .select()
    .from(hubControlsTable)
    .where(eq(hubControlsTable.id, HUB_CONTROLS_ID));
  return row;
}

/** Update one or both global-control flags and stamp updatedAt. */
export async function updateControls(
  patch: { paused?: boolean; quietMode?: boolean },
): Promise<HubControls> {
  await loadControls();
  const [row] = await db
    .update(hubControlsTable)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(hubControlsTable.id, HUB_CONTROLS_ID))
    .returning();
  publishEvent({ type: "controls.changed", data: row });
  return row;
}
