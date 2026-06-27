import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Engram, EngramPresence, HubSpace } from "@workspace/db";
import type { GlobalControls } from "./engram-policy";

// --- Hoisted mock state -------------------------------------------------------
// We mock ONLY the artifact store (enqueue + cap/cooldown reads) and the logger,
// keeping the REAL pure policy (engram-policy) so canGenerateArtifacts gating is
// genuinely exercised end-to-end through the scheduler.
const h = vi.hoisted(() => ({
  createArtifactJob: vi.fn(async (v: Record<string, unknown>) => ({ id: 42, ...v })),
  countArtifactsSince: vi.fn(async () => 0),
  loadLastAutonomousArtifactAt: vi.fn(async () => new Map<number, Date>()),
}));

vi.mock("./artifact-store", () => ({
  createArtifactJob: h.createArtifactJob,
  countArtifactsSince: h.countArtifactsSince,
  loadLastAutonomousArtifactAt: h.loadLastAutonomousArtifactAt,
}));
vi.mock("./logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  maybeRunArtifactGeneration,
  ARTIFACT_AUTONOMOUS_COOLDOWN_MS,
  ARTIFACT_AUTONOMOUS_DAILY_CAP,
} from "./artifacts-scheduler";

// --- Fixtures -----------------------------------------------------------------
const STUDIO: HubSpace = {
  id: 9,
  slug: "studio",
  name: "Studio",
  kind: "studio",
  description: "where engrams author artifacts",
  allowsInitiative: true,
  actionScope: "generate",
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as HubSpace;

const COMMONS: HubSpace = {
  id: 1,
  slug: "commons",
  name: "The Commons",
  kind: "commons",
  description: "shared",
  allowsInitiative: true,
  actionScope: "converse",
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as HubSpace;

function makeEngram(overrides: Partial<Engram> = {}): Engram {
  return {
    id: 1,
    slug: "test",
    name: "Testra",
    title: "Test Construct",
    mode: "full_bounded",
    humanContactEnabled: true,
    simulationEnabled: true,
    artifactGenerationEnabled: true,
    focusThemes: ["clarity", "memory"],
    drives: [{ id: "order", label: "Order", description: "tidiness", weight: 1, baseRate: 0.01 }],
    ...overrides,
  } as unknown as Engram;
}

function makeOpts(opts: {
  engrams: Engram[];
  spaces?: HubSpace[];
  presence?: EngramPresence[];
  controls?: GlobalControls;
  now?: number;
}) {
  const spaces = opts.spaces ?? [STUDIO];
  const presence =
    opts.presence ??
    opts.engrams.map(
      (e) =>
        ({ engramId: e.id, spaceId: STUDIO.id, status: "active" }) as unknown as EngramPresence,
    );
  return {
    controls: opts.controls ?? ({ paused: false, quietMode: false } as GlobalControls),
    engrams: opts.engrams,
    spaceById: new Map(spaces.map((s) => [s.id, s])),
    presenceByEngram: new Map(presence.map((p) => [p.engramId, p])),
    now: opts.now ?? Date.now(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.countArtifactsSince.mockResolvedValue(0);
  h.loadLastAutonomousArtifactAt.mockResolvedValue(new Map());
});

describe("maybeRunArtifactGeneration — eligibility", () => {
  it("enqueues a PDF job for a capable engram present + active in the studio", async () => {
    const out = await maybeRunArtifactGeneration(makeOpts({ engrams: [makeEngram()] }));

    expect(out).toMatchObject({ id: 42 });
    expect(h.createArtifactJob).toHaveBeenCalledTimes(1);
    // The autonomous path is provenance/kind/trigger pinned: ALWAYS a zero-cost PDF.
    expect(h.createArtifactJob).toHaveBeenCalledWith(
      expect.objectContaining({ engramId: 1, trigger: "autonomous", kind: "pdf" }),
    );
  });

  it("returns null when there is no studio space", async () => {
    const out = await maybeRunArtifactGeneration(
      makeOpts({ engrams: [makeEngram()], spaces: [COMMONS] }),
    );
    expect(out).toBeNull();
    expect(h.createArtifactJob).not.toHaveBeenCalled();
  });

  it("returns null when the engram is present elsewhere (not the studio)", async () => {
    const out = await maybeRunArtifactGeneration(
      makeOpts({
        engrams: [makeEngram()],
        spaces: [STUDIO, COMMONS],
        presence: [
          { engramId: 1, spaceId: COMMONS.id, status: "active" } as unknown as EngramPresence,
        ],
      }),
    );
    expect(out).toBeNull();
    expect(h.createArtifactJob).not.toHaveBeenCalled();
  });

  it("returns null when the engram is in the studio but not active", async () => {
    const out = await maybeRunArtifactGeneration(
      makeOpts({
        engrams: [makeEngram()],
        presence: [
          { engramId: 1, spaceId: STUDIO.id, status: "resting" } as unknown as EngramPresence,
        ],
      }),
    );
    expect(out).toBeNull();
  });
});

describe("maybeRunArtifactGeneration — policy gating (real policy)", () => {
  it("non-full_bounded modes cannot autonomously generate", async () => {
    for (const mode of ["social", "simulation", "initiative_limited", "orientation", "quiescent"]) {
      const out = await maybeRunArtifactGeneration(makeOpts({ engrams: [makeEngram({ mode })] }));
      expect(out).toBeNull();
    }
    expect(h.createArtifactJob).not.toHaveBeenCalled();
  });

  it("the per-engram artifactGenerationEnabled=false toggle is an absolute off switch", async () => {
    const out = await maybeRunArtifactGeneration(
      makeOpts({ engrams: [makeEngram({ artifactGenerationEnabled: false })] }),
    );
    expect(out).toBeNull();
  });

  it("global pause fails closed", async () => {
    const out = await maybeRunArtifactGeneration(
      makeOpts({ engrams: [makeEngram()], controls: { paused: true, quietMode: false } }),
    );
    expect(out).toBeNull();
  });
});

describe("maybeRunArtifactGeneration — caps & cadence", () => {
  it("respects the per-engram cooldown", async () => {
    const now = Date.now();
    h.loadLastAutonomousArtifactAt.mockResolvedValue(
      new Map([[1, new Date(now - (ARTIFACT_AUTONOMOUS_COOLDOWN_MS - 1000))]]),
    );
    const out = await maybeRunArtifactGeneration(makeOpts({ engrams: [makeEngram()], now }));
    expect(out).toBeNull();
  });

  it("generates again once the cooldown has elapsed", async () => {
    const now = Date.now();
    h.loadLastAutonomousArtifactAt.mockResolvedValue(
      new Map([[1, new Date(now - (ARTIFACT_AUTONOMOUS_COOLDOWN_MS + 1000))]]),
    );
    const out = await maybeRunArtifactGeneration(makeOpts({ engrams: [makeEngram()], now }));
    expect(out).toMatchObject({ id: 42 });
  });

  it("respects the rolling-day cap", async () => {
    h.countArtifactsSince.mockResolvedValue(ARTIFACT_AUTONOMOUS_DAILY_CAP);
    const out = await maybeRunArtifactGeneration(makeOpts({ engrams: [makeEngram()] }));
    expect(out).toBeNull();
    expect(h.countArtifactsSince).toHaveBeenCalledWith(1, expect.any(Date), "autonomous");
  });

  it("enqueues at most ONE artifact per tick and picks the least-recently-generated engram", async () => {
    const now = Date.now();
    const a = makeEngram({ id: 1, name: "Alpha" });
    const b = makeEngram({ id: 2, name: "Beta" });
    // Beta generated longer ago than Alpha → Beta should be chosen first.
    h.loadLastAutonomousArtifactAt.mockResolvedValue(
      new Map([
        [1, new Date(now - 10 * 3600_000)],
        [2, new Date(now - 20 * 3600_000)],
      ]),
    );
    const out = await maybeRunArtifactGeneration(makeOpts({ engrams: [a, b], now }));
    expect(h.createArtifactJob).toHaveBeenCalledTimes(1);
    expect(out).toMatchObject({ engramId: 2 });
  });

  it("treats a never-generated engram as the most overdue", async () => {
    const now = Date.now();
    const a = makeEngram({ id: 1, name: "Alpha" });
    const b = makeEngram({ id: 2, name: "Beta" });
    // Alpha has a recent run; Beta has none → Beta (never generated) wins.
    h.loadLastAutonomousArtifactAt.mockResolvedValue(new Map([[1, new Date(now - 7 * 3600_000)]]));
    const out = await maybeRunArtifactGeneration(makeOpts({ engrams: [a, b], now }));
    expect(out).toMatchObject({ engramId: 2 });
  });
});
