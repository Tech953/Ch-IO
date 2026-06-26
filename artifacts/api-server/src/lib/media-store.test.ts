import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// --- Hoisted mock state --------------------------------------------------------
const h = vi.hoisted(() => {
  const mediaObservationsTable = { __table: "media_observations" } as Record<string, unknown>;
  const state = { inserts: [] as Record<string, unknown>[] };

  const db = {
    insert: (_t: unknown) => ({
      values: (v: Record<string, unknown>) => {
        state.inserts.push(v);
        return Promise.resolve(undefined);
      },
    }),
  };

  const appendWorldModelEntry = vi.fn(async (entry: Record<string, unknown>) => ({
    id: 42,
    ...entry,
  }));

  return { mediaObservationsTable, state, db, appendWorldModelEntry };
});

vi.mock("@workspace/db", () => ({ db: h.db }));
vi.mock("@workspace/db/schema", () => ({
  mediaAssetsTable: { __table: "media_assets" },
  mediaBlobsTable: { __table: "media_blobs" },
  mediaObservationsTable: h.mediaObservationsTable,
  engramWorldModelTable: { __table: "world_model" },
}));
vi.mock("drizzle-orm", () => ({
  and: () => ({}),
  asc: () => ({}),
  desc: () => ({}),
  eq: () => ({}),
  lt: () => ({}),
}));
vi.mock("./world-model-store", () => ({
  appendWorldModelEntry: h.appendWorldModelEntry,
}));

import { appendMediaObservation } from "./media-store";

beforeEach(() => {
  h.state.inserts = [];
  h.appendWorldModelEntry.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// --- Provenance guarantee ------------------------------------------------------
describe("appendMediaObservation — structural provenance guarantee", () => {
  it("always records OBSERVED provenance and a media:<id> source, regardless of input", async () => {
    await appendMediaObservation({
      assetId: 7,
      engramId: 3,
      content: "A lighthouse blinks twice.",
      confidence: 0.85,
    });

    expect(h.appendWorldModelEntry).toHaveBeenCalledTimes(1);
    const entry = h.appendWorldModelEntry.mock.calls[0][0];
    expect(entry).toMatchObject({
      engramId: 3,
      provenance: "observed",
      content: "A lighthouse blinks twice.",
      confidence: 0.85,
      scope: "private",
      source: "media:7",
    });
  });

  it("links the new world-model entry back to the asset via the mapping table", async () => {
    const result = await appendMediaObservation({
      assetId: 7,
      engramId: 3,
      content: "obs",
      confidence: 0.85,
    });

    // The returned entry is the world-model row (so callers can reference it).
    expect(result.id).toBe(42);
    // ...and exactly one mapping row was inserted tying asset -> entry.
    expect(h.state.inserts).toHaveLength(1);
    expect(h.state.inserts[0]).toEqual({ assetId: 7, worldModelEntryId: 42 });
  });
});
