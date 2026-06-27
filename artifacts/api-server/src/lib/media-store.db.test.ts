import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";

// Run these against a REAL embedded Postgres (in-memory PGlite), not a mock, so
// the actual SQL/locking semantics of the media queue are exercised. The driver
// seam in `@workspace/db` reads `ENGRAM_DB_DRIVER` at import time, so it must be
// set *before* the module graph loads — `vi.hoisted` runs ahead of all imports.
// Leaving `PGLITE_DATA_DIR` unset makes PGlite run purely in-memory.
vi.hoisted(() => {
  process.env.ENGRAM_DB_DRIVER = "pglite";
  delete process.env.PGLITE_DATA_DIR;
});

import { db, ensureDatabaseReady, closeDb, mediaAssetsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { MediaModality, MediaJobStatus } from "@workspace/db/schema";
import { claimNextPendingJob, recoverStuckJobs } from "./media-store";

// Bring the in-memory schema up before any test runs (migrate only — no seed).
const ready = ensureDatabaseReady({ seed: false });

beforeEach(async () => {
  await ready;
  // Each test starts from an empty queue.
  await db.delete(mediaAssetsTable);
});

afterAll(async () => {
  await closeDb();
});

/** Insert a media-asset row directly, bypassing the upload route. */
async function insertAsset(overrides: {
  status?: MediaJobStatus;
  modality?: MediaModality;
  createdAt?: Date;
  startedAt?: Date | null;
}): Promise<number> {
  const [row] = await db
    .insert(mediaAssetsTable)
    .values({
      engramId: null,
      filename: "asset.txt",
      mimeType: "text/plain",
      modality: overrides.modality ?? "text",
      sizeBytes: 1,
      status: overrides.status ?? "pending",
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
      ...(overrides.startedAt !== undefined ? { startedAt: overrides.startedAt } : {}),
    })
    .returning({ id: mediaAssetsTable.id });
  return row.id;
}

async function statusOf(id: number): Promise<MediaJobStatus | undefined> {
  const [row] = await db
    .select({ status: mediaAssetsTable.status })
    .from(mediaAssetsTable)
    .where(eq(mediaAssetsTable.id, id));
  return row?.status as MediaJobStatus | undefined;
}

// --- claimNextPendingJob -------------------------------------------------------
describe("claimNextPendingJob — atomic claim against a real DB", () => {
  it("transitions exactly one pending row to 'processing' and stamps startedAt", async () => {
    const id = await insertAsset({ status: "pending" });

    const claimed = await claimNextPendingJob();

    expect(claimed).toBeDefined();
    expect(claimed!.id).toBe(id);
    expect(claimed!.status).toBe("processing");
    expect(claimed!.startedAt).toBeInstanceOf(Date);
    // The row really moved to processing in the DB, not just in the return value.
    expect(await statusOf(id)).toBe("processing");
  });

  it("returns undefined when nothing is pending", async () => {
    await insertAsset({ status: "completed" });
    await insertAsset({ status: "failed" });
    await insertAsset({ status: "processing", startedAt: new Date() });

    expect(await claimNextPendingJob()).toBeUndefined();
  });

  it("claims the OLDEST pending job first (FIFO by createdAt)", async () => {
    const older = await insertAsset({
      status: "pending",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    await insertAsset({
      status: "pending",
      createdAt: new Date("2026-06-01T00:00:00Z"),
    });

    const claimed = await claimNextPendingJob();
    expect(claimed!.id).toBe(older);
  });

  it("two concurrent claims of a single pending row yield it to exactly one caller", async () => {
    const id = await insertAsset({ status: "pending" });

    // FOR UPDATE SKIP LOCKED guarantees the second claimer never grabs the same
    // row: it is either skipped (locked) or sees no pending row once committed.
    const [a, b] = await Promise.all([
      claimNextPendingJob(),
      claimNextPendingJob(),
    ]);

    const winners = [a, b].filter((r) => r !== undefined);
    expect(winners).toHaveLength(1);
    expect(winners[0]!.id).toBe(id);
    expect(winners[0]!.status).toBe("processing");
    // The single row was claimed once — never double-processed.
    expect(await statusOf(id)).toBe("processing");
  });

  it("two concurrent claims of two pending rows each get a distinct row", async () => {
    const first = await insertAsset({
      status: "pending",
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });
    const second = await insertAsset({
      status: "pending",
      createdAt: new Date("2026-02-01T00:00:00Z"),
    });

    const [a, b] = await Promise.all([
      claimNextPendingJob(),
      claimNextPendingJob(),
    ]);

    expect(a).toBeDefined();
    expect(b).toBeDefined();
    // No two workers ever land on the same upload.
    expect(new Set([a!.id, b!.id])).toEqual(new Set([first, second]));
  });
});

// --- recoverStuckJobs ----------------------------------------------------------
describe("recoverStuckJobs — stuck-job recovery against a real DB", () => {
  const ONE_HOUR = 60 * 60 * 1000;

  it("fails only 'processing' rows started before the cutoff", async () => {
    const stuck = await insertAsset({
      status: "processing",
      startedAt: new Date(Date.now() - 2 * ONE_HOUR),
    });

    const recovered = await recoverStuckJobs(ONE_HOUR);

    expect(recovered).toBe(1);
    expect(await statusOf(stuck)).toBe("failed");
    const [row] = await db
      .select({ error: mediaAssetsTable.error })
      .from(mediaAssetsTable)
      .where(eq(mediaAssetsTable.id, stuck));
    expect(row.error).toMatch(/timed out/i);
  });

  it("leaves a fresh 'processing' row (started after the cutoff) alone", async () => {
    const fresh = await insertAsset({
      status: "processing",
      startedAt: new Date(Date.now() - 1000),
    });

    const recovered = await recoverStuckJobs(ONE_HOUR);

    expect(recovered).toBe(0);
    expect(await statusOf(fresh)).toBe("processing");
  });

  it("never touches pending/completed/failed rows, however old", async () => {
    const oldStart = new Date(Date.now() - 5 * ONE_HOUR);
    const pending = await insertAsset({ status: "pending" });
    const completed = await insertAsset({
      status: "completed",
      startedAt: oldStart,
    });
    const failed = await insertAsset({ status: "failed", startedAt: oldStart });

    const recovered = await recoverStuckJobs(ONE_HOUR);

    expect(recovered).toBe(0);
    expect(await statusOf(pending)).toBe("pending");
    expect(await statusOf(completed)).toBe("completed");
    expect(await statusOf(failed)).toBe("failed");
  });

  it("recovers only the stuck rows when stuck and fresh jobs coexist", async () => {
    const stuck = await insertAsset({
      status: "processing",
      startedAt: new Date(Date.now() - 3 * ONE_HOUR),
    });
    const fresh = await insertAsset({
      status: "processing",
      startedAt: new Date(Date.now() - 1000),
    });

    const recovered = await recoverStuckJobs(ONE_HOUR);

    expect(recovered).toBe(1);
    expect(await statusOf(stuck)).toBe("failed");
    expect(await statusOf(fresh)).toBe("processing");
  });

  it("a recovered (now 'failed') job is no longer claimable", async () => {
    await insertAsset({
      status: "processing",
      startedAt: new Date(Date.now() - 2 * ONE_HOUR),
    });

    await recoverStuckJobs(ONE_HOUR);

    // Recovery fails the wedged job; it does NOT re-queue it, so the worker
    // won't immediately re-claim a job that just timed out.
    expect(await claimNextPendingJob()).toBeUndefined();
  });
});
