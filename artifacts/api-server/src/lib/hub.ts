import type { HubActivityKind, PresenceStatus } from "@workspace/db";

/**
 * Pure, DB-free Hub helpers. The single enforced action-scope rule lives here:
 * a space that disallows initiative is a rest zone, and an engram located there
 * is at rest. Movement summaries for the archive are also formatted here.
 */

export interface SpaceLike {
  name: string;
  allowsInitiative: boolean;
}

/** Whether engrams present in this space may self-initiate (false = a rest/quiescence zone). */
export function spaceAllowsInitiative(space: { allowsInitiative: boolean }): boolean {
  return space.allowsInitiative;
}

/** The presence status an engram takes on by virtue of the space it is in. */
export function statusForSpace(space: { allowsInitiative: boolean }): PresenceStatus {
  return space.allowsInitiative ? "active" : "resting";
}

/**
 * Classify and describe a movement for the activity archive. `previous` is null
 * for an engram's first placement.
 * - no previous            -> "enter"
 * - entering a rest zone    -> "rest"
 * - leaving a rest zone     -> "wake"
 * - otherwise              -> "move"
 */
export function describeMovement(
  engramName: string,
  target: SpaceLike,
  previous: SpaceLike | null,
): { kind: HubActivityKind; summary: string } {
  if (!previous) {
    return { kind: "enter", summary: `${engramName} entered ${target.name}.` };
  }
  if (!target.allowsInitiative) {
    return {
      kind: "rest",
      summary: `${engramName} settled into ${target.name} to rest.`,
    };
  }
  if (!previous.allowsInitiative) {
    return {
      kind: "wake",
      summary: `${engramName} woke and moved from ${previous.name} to ${target.name}.`,
    };
  }
  return {
    kind: "move",
    summary: `${engramName} moved from ${previous.name} to ${target.name}.`,
  };
}
