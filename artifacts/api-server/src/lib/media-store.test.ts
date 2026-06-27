import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// --- Hoisted mock state --------------------------------------------------------
const h = vi.hoisted(() => {
  const mediaObservationsTable = { __table: "media_observations" } as Record<string, unknown>;
  const state = {
    inserts: [] as Record<string, unknown>[],
    updates: [] as Record<string, unknown>[],
    nextId: 100,
    conversationMedia: [] as Record<string, unknown>[],
  };

  const db = {
    insert: (_t: unknown) => ({
      values: (v: Record<string, unknown>) => {
        state.inserts.push(v);
        const inserted = [{ id: ++state.nextId, ...v }];
        const done = Promise.resolve(undefined);
        return {
          returning: () => Promise.resolve(inserted),
          then: done.then.bind(done),
        };
      },
    }),
    update: (_t: unknown) => ({
      set: (patch: Record<string, unknown>) => ({
        where: (_p: unknown) => {
          state.updates.push(patch);
          return Promise.resolve(undefined);
        },
      }),
    }),
    select: () => {
      const chain = {
        from: () => chain,
        where: () => chain,
        orderBy: () => Promise.resolve(state.conversationMedia),
      };
      return chain;
    },
    transaction: async (fn: (tx: unknown) => unknown) => fn(db),
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
  messages: { __table: "messages" },
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

import {
  appendMediaObservation,
  loadConversationMedia,
  upsertMediaContextMessage,
} from "./media-store";
import type { MediaAsset } from "@workspace/db";

beforeEach(() => {
  h.state.inserts = [];
  h.state.updates = [];
  h.state.nextId = 100;
  h.state.conversationMedia = [];
  h.appendWorldModelEntry.mockClear();
});

function makeAsset(overrides: Partial<MediaAsset> = {}): MediaAsset {
  return {
    id: 7,
    engramId: null,
    conversationId: 5,
    contextMessageId: null,
    filename: "harbor.png",
    mimeType: "image/png",
    modality: "image",
    sizeBytes: 10,
    status: "completed",
    summary: "A lighthouse blinks twice.",
    commentary: null,
    transcript: null,
    error: null,
    observationCount: 1,
    startedAt: null,
    completedAt: new Date("2026-06-26T00:00:00Z"),
    createdAt: new Date("2026-06-26T00:00:00Z"),
    updatedAt: new Date("2026-06-26T00:00:00Z"),
    ...overrides,
  } as MediaAsset;
}

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

// --- Inline context message: idempotent insert-then-update ---------------------
describe("upsertMediaContextMessage — idempotent thread surfacing", () => {
  it("no-ops when the asset is not bound to a conversation", async () => {
    await upsertMediaContextMessage(makeAsset({ conversationId: null }), "ignored");
    expect(h.state.inserts).toHaveLength(0);
    expect(h.state.updates).toHaveLength(0);
  });

  it("first completion inserts a `context` message and stamps contextMessageId", async () => {
    await upsertMediaContextMessage(
      makeAsset({ conversationId: 5, contextMessageId: null }),
      "perceived body",
    );

    // One message insert with the `context` role...
    expect(h.state.inserts).toHaveLength(1);
    expect(h.state.inserts[0]).toMatchObject({
      conversationId: 5,
      role: "context",
      content: "perceived body",
    });
    // ...and the asset is stamped with the new message id (so a retry updates, not dupes).
    expect(h.state.updates).toHaveLength(1);
    expect(h.state.updates[0]).toMatchObject({ contextMessageId: 101 });
  });

  it("re-perception updates the existing message instead of inserting a new one", async () => {
    await upsertMediaContextMessage(
      makeAsset({ conversationId: 5, contextMessageId: 77 }),
      "refreshed body",
    );

    // No new message inserted...
    expect(h.state.inserts).toHaveLength(0);
    // ...the existing one is updated in place.
    expect(h.state.updates).toHaveLength(1);
    expect(h.state.updates[0]).toMatchObject({ content: "refreshed body" });
  });
});

// --- Conversation media listing ------------------------------------------------
describe("loadConversationMedia", () => {
  it("returns the assets the mock store yields for the conversation", async () => {
    const rows = [makeAsset({ id: 1 }), makeAsset({ id: 2 })];
    h.state.conversationMedia = rows as unknown as Record<string, unknown>[];
    const result = await loadConversationMedia(5);
    expect(result.map((r) => r.id)).toEqual([1, 2]);
  });
});
