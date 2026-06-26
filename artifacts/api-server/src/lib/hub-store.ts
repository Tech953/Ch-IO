import { db } from "@workspace/db";
import {
  hubSpacesTable,
  engramPresenceTable,
  hubActivityLogTable,
} from "@workspace/db/schema";
import type { HubSpace, EngramPresence, HubActivity, HubActivityKind } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { statusForSpace, describeMovement } from "./hub";

const ACTIVITY_DEFAULT_LIMIT = 50;
const ACTIVITY_MAX_LIMIT = 200;

export async function loadSpaces(): Promise<HubSpace[]> {
  return db.select().from(hubSpacesTable).orderBy(hubSpacesTable.sortOrder);
}

export async function loadSpaceById(id: number): Promise<HubSpace | undefined> {
  const [row] = await db.select().from(hubSpacesTable).where(eq(hubSpacesTable.id, id));
  return row;
}

export async function loadPresence(): Promise<EngramPresence[]> {
  return db.select().from(engramPresenceTable);
}

export async function loadPresenceForEngram(
  engramId: number,
): Promise<EngramPresence | undefined> {
  const [row] = await db
    .select()
    .from(engramPresenceTable)
    .where(eq(engramPresenceTable.engramId, engramId));
  return row;
}

export async function loadActivity(
  opts: { spaceId?: number; limit?: number } = {},
): Promise<HubActivity[]> {
  const limit = Math.min(
    Math.max(opts.limit ?? ACTIVITY_DEFAULT_LIMIT, 1),
    ACTIVITY_MAX_LIMIT,
  );
  if (opts.spaceId !== undefined) {
    return db
      .select()
      .from(hubActivityLogTable)
      .where(eq(hubActivityLogTable.spaceId, opts.spaceId))
      .orderBy(desc(hubActivityLogTable.createdAt))
      .limit(limit);
  }
  return db
    .select()
    .from(hubActivityLogTable)
    .orderBy(desc(hubActivityLogTable.createdAt))
    .limit(limit);
}

export async function appendActivity(entry: {
  spaceId: number;
  engramId?: number | null;
  kind: HubActivityKind;
  summary: string;
}): Promise<HubActivity> {
  const [row] = await db
    .insert(hubActivityLogTable)
    .values({
      spaceId: entry.spaceId,
      engramId: entry.engramId ?? null,
      kind: entry.kind,
      summary: entry.summary,
    })
    .returning();
  return row;
}

/**
 * Move (or first-place) an engram into a space. Transactional: the presence
 * upsert and the archive entry succeed or fail together. `enteredAt` only resets
 * when the engram actually changes spaces. Movement is logged only when the
 * source or target space has logging enabled (and only on a real space change).
 */
export async function movePresence(args: {
  engram: { id: number; name: string };
  targetSpace: HubSpace;
  note?: string | null;
}): Promise<EngramPresence> {
  const { engram, targetSpace, note } = args;
  const status = statusForSpace(targetSpace);
  const now = new Date();

  return db.transaction(async (tx) => {
    const [previous] = await tx
      .select()
      .from(engramPresenceTable)
      .where(eq(engramPresenceTable.engramId, engram.id));

    let previousSpace: HubSpace | undefined;
    if (previous) {
      [previousSpace] = await tx
        .select()
        .from(hubSpacesTable)
        .where(eq(hubSpacesTable.id, previous.spaceId));
    }

    const sameSpace = previous?.spaceId === targetSpace.id;

    const [presence] = await tx
      .insert(engramPresenceTable)
      .values({
        engramId: engram.id,
        spaceId: targetSpace.id,
        status,
        note: note ?? null,
        enteredAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: engramPresenceTable.engramId,
        set: {
          spaceId: targetSpace.id,
          status,
          note: note ?? null,
          ...(sameSpace ? {} : { enteredAt: now }),
          updatedAt: now,
        },
      })
      .returning();

    const shouldLog =
      !sameSpace && (targetSpace.logged || (previousSpace?.logged ?? false));
    if (shouldLog) {
      const { kind, summary } = describeMovement(
        engram.name,
        { name: targetSpace.name, allowsInitiative: targetSpace.allowsInitiative },
        previousSpace
          ? { name: previousSpace.name, allowsInitiative: previousSpace.allowsInitiative }
          : null,
      );
      await tx.insert(hubActivityLogTable).values({
        spaceId: targetSpace.id,
        engramId: engram.id,
        kind,
        summary,
      });
    }

    return presence;
  });
}
