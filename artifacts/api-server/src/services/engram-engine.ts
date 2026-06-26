import { db } from "@workspace/db";
import { engramsTable, engramTransmissionsTable } from "@workspace/db/schema";
import type { Engram, EngramTransmission, DriveState } from "@workspace/db";
import { and, desc, eq, gte } from "drizzle-orm";
import { logger } from "../lib/logger";
import { generateTransmission, type TransmissionKind } from "../lib/engram-generation";

// --- Tunable constants (cost & cadence guards) ---
const GLOBAL_TICK_MS = 20_000; // how often the engine wakes up
const COOLDOWN_MS = 90_000; // minimum gap between an engram's transmissions
const HOURLY_CAP = 10; // max transmissions per engram per rolling hour
const DAILY_CAP = 60; // max transmissions per engram per rolling day
const MAX_ELAPSED_SEC = 600; // cap accrual after long downtime / clock jumps
const ERROR_BACKOFF_MS = 120_000; // skip generation for an engram after a failure

const OUTREACH_HINT = /(connection|devotion|loyal|protect|chaos|fun|reach|company)/i;

let ticking = false; // re-entrancy guard for a single tick
let started = false; // lifecycle guard so the engine only starts once
let timer: NodeJS.Timeout | null = null;
const errorBackoff = new Map<number, number>(); // engramId -> backoff-until epoch ms

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function pickKind(driveId: string, label: string): TransmissionKind {
  return OUTREACH_HINT.test(`${driveId} ${label}`) ? "outreach" : "idle";
}

interface DriveCharge {
  id: string;
  label: string;
  description: string;
  pressure: number;
  charge: number; // pressure * weight
}

/** Accrue per-drive pressure from elapsed time (no LLM). Returns the new state + ranked charges. */
function accrue(engram: Engram, now: number): { state: DriveState; charges: DriveCharge[] } {
  const last = engram.lastTickAt ? new Date(engram.lastTickAt).getTime() : now;
  const elapsedSec = clamp((now - last) / 1000, 0, MAX_ELAPSED_SEC);
  const state: DriveState = { ...(engram.driveState ?? {}) };
  const charges: DriveCharge[] = [];

  for (const drive of engram.drives) {
    const prev = typeof state[drive.id] === "number" ? state[drive.id] : 0;
    const jitter = 0.85 + Math.random() * 0.3;
    const gained = drive.baseRate * elapsedSec * jitter;
    const pressure = clamp(prev + gained, 0, 1);
    state[drive.id] = pressure;
    charges.push({
      id: drive.id,
      label: drive.label,
      description: drive.description,
      pressure,
      charge: pressure * drive.weight,
    });
  }
  charges.sort((a, b) => b.charge - a.charge);
  return { state, charges };
}

async function recentTransmissions(engramId: number, since: number): Promise<EngramTransmission[]> {
  return db
    .select()
    .from(engramTransmissionsTable)
    .where(
      and(
        eq(engramTransmissionsTable.engramId, engramId),
        gte(engramTransmissionsTable.createdAt, new Date(since)),
      ),
    )
    .orderBy(desc(engramTransmissionsTable.createdAt));
}

/**
 * Generate and persist a single transmission for an engram from a specific drive.
 * Resets that drive's pressure and bleeds the rest so it does not immediately re-fire.
 */
async function emit(
  engram: Engram,
  top: DriveCharge,
  state: DriveState,
  recentContents: string[],
  now: number,
): Promise<EngramTransmission> {
  const kind = pickKind(top.id, top.label);
  const content = await generateTransmission({
    engram,
    kind,
    drive: { id: top.id, label: top.label, description: top.description },
    recentContents,
  });

  const importance = clamp(top.charge, 0, 1);
  const confidence = clamp(1 - engram.emotionalBaseline.volatility * 0.4, 0.3, 1);
  const dupe = recentContents.some(
    (c) => c.slice(0, 40).toLowerCase() === content.slice(0, 40).toLowerCase(),
  );
  const novelty = clamp((dupe ? 0.3 : 0.7) + Math.random() * 0.2, 0, 1);
  const overall = clamp(importance * 0.5 + confidence * 0.2 + novelty * 0.3, 0, 1);

  // Reset the firing drive and bleed the others.
  const nextState: DriveState = {};
  for (const [k, v] of Object.entries(state)) {
    nextState[k] = k === top.id ? 0.05 : clamp(v * 0.7, 0, 1);
  }

  const [row] = await db
    .insert(engramTransmissionsTable)
    .values({
      engramId: engram.id,
      kind,
      drive: top.label,
      content: content || "…",
      mood: engram.currentMood ?? engram.emotionalBaseline.mood,
      importanceScore: importance,
      confidenceScore: confidence,
      noveltyScore: novelty,
      overallScore: overall,
      wasDelivered: kind === "outreach",
      seen: false,
    })
    .returning();

  await db
    .update(engramsTable)
    .set({
      driveState: nextState,
      lastTransmissionAt: new Date(now),
      lastTickAt: new Date(now),
      updatedAt: new Date(now),
    })
    .where(eq(engramsTable.id, engram.id));

  return row;
}

export interface TickResult {
  ticked: number;
  generated: number;
  transmissions: EngramTransmission[];
}

/**
 * Process one engine tick. Accrues pressure for every autonomy-enabled engram and,
 * where an engram's top drive crosses its initiation threshold (subject to cooldown
 * and rate caps), generates exactly one transmission for it.
 *
 * @param opts.force ignore per-engram cadence (used by the manual /tick endpoint).
 */
export async function runTick(opts: { force?: boolean } = {}): Promise<TickResult> {
  if (ticking) return { ticked: 0, generated: 0, transmissions: [] };
  ticking = true;
  const now = Date.now();
  const produced: EngramTransmission[] = [];
  let ticked = 0;

  try {
    const engrams = await db
      .select()
      .from(engramsTable)
      .where(eq(engramsTable.autonomyEnabled, true));

    for (const engram of engrams) {
      const last = engram.lastTickAt ? new Date(engram.lastTickAt).getTime() : 0;
      const cadenceMs = engram.tickCadenceSeconds * 1000;
      if (!opts.force && now - last < cadenceMs) continue;
      ticked++;

      const { state, charges } = accrue(engram, now);

      // Persist accrued pressure even when we don't generate (restart-safe).
      let persistedState = false;
      const persistState = async () => {
        await db
          .update(engramsTable)
          .set({ driveState: state, lastTickAt: new Date(now), updatedAt: new Date(now) })
          .where(eq(engramsTable.id, engram.id));
        persistedState = true;
      };

      const top = charges[0];
      const crossed = top && top.charge >= engram.initiationThreshold;
      const onCooldown =
        engram.lastTransmissionAt &&
        now - new Date(engram.lastTransmissionAt).getTime() < COOLDOWN_MS;
      const backoffUntil = errorBackoff.get(engram.id) ?? 0;
      const inBackoff = now < backoffUntil;

      if (!crossed || onCooldown || inBackoff) {
        await persistState();
        continue;
      }

      // Rate caps (rolling hour / day).
      const recent = await recentTransmissions(engram.id, now - 24 * 3600_000);
      const hourCount = recent.filter(
        (r) => now - new Date(r.createdAt).getTime() < 3600_000,
      ).length;
      if (recent.length >= DAILY_CAP || hourCount >= HOURLY_CAP) {
        await persistState();
        continue;
      }

      try {
        const tx = await emit(
          engram,
          top,
          state,
          recent.slice(0, 5).map((r) => r.content),
          now,
        );
        produced.push(tx);
        errorBackoff.delete(engram.id);
      } catch (err) {
        logger.error({ err, engramId: engram.id }, "engram transmission generation failed");
        errorBackoff.set(engram.id, now + ERROR_BACKOFF_MS);
        if (!persistedState) await persistState();
      }
    }
  } finally {
    ticking = false;
  }

  return { ticked, generated: produced.length, transmissions: produced };
}

/**
 * Force a single transmission for one engram now, bypassing threshold/cadence (still
 * respects the error backoff). Used by the manual /transmit endpoint.
 */
export async function forceTransmission(engram: Engram): Promise<EngramTransmission> {
  const now = Date.now();
  const { state, charges } = accrue(engram, now);
  const top = charges[0] ?? {
    id: engram.drives[0]?.id ?? "drive",
    label: engram.drives[0]?.label ?? "impulse",
    description: engram.drives[0]?.description ?? "",
    pressure: 0.6,
    charge: 0.6,
  };
  const recent = await recentTransmissions(engram.id, now - 24 * 3600_000);
  return emit(engram, top, state, recent.slice(0, 5).map((r) => r.content), now);
}

export function startEngramEngine(): void {
  if (started) return;
  started = true;
  timer = setInterval(() => {
    runTick().catch((err) => logger.error({ err }, "engram engine tick failed"));
  }, GLOBAL_TICK_MS);
  if (typeof timer.unref === "function") timer.unref();
  logger.info({ intervalMs: GLOBAL_TICK_MS }, "engram engine started");
}

export function stopEngramEngine(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  started = false;
}
