import { Router } from "express";
import { db } from "@workspace/db";
import {
  engramsTable,
  engramTransmissionsTable,
  engramInquiriesTable,
} from "@workspace/db/schema";
import type { Engram, EmotionalBaseline } from "@workspace/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  GetEngramParams,
  UpdateEngramConfigParams,
  UpdateEngramConfigBody,
  ActivateEngramParams,
  TransmitEngramParams,
  ListEngramTransmissionsParams,
  MarkTransmissionsSeenParams,
  MarkTransmissionsSeenBody,
  ListEngramInquiriesParams,
  CreateEngramInquiryParams,
  CreateEngramInquiryBody,
} from "@workspace/api-zod";
import { runTick, forceTransmission } from "../services/engram-engine";
import { generateProbeResponse, generateDevelopment } from "../lib/engram-generation";

const router = Router();

const TRANSMISSION_LIST_CAP = 100;
const MAX_FACTS = 30;

async function loadEngram(id: number): Promise<Engram | undefined> {
  const [row] = await db.select().from(engramsTable).where(eq(engramsTable.id, id));
  return row;
}

router.get("/engrams", async (_req, res) => {
  const rows = await db.select().from(engramsTable).orderBy(engramsTable.id);
  res.json(rows);
});

// Must be registered before "/engrams/:id" so "tick" is not parsed as an id.
router.post("/engrams/tick", async (_req, res) => {
  const result = await runTick({ force: true });
  res.json(result);
});

router.get("/engrams/:id", async (req, res) => {
  const parsed = GetEngramParams.safeParse({ id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const engram = await loadEngram(parsed.data.id);
  if (!engram) {
    res.status(404).json({ error: "Engram not found" });
    return;
  }
  res.json(engram);
});

router.patch("/engrams/:id", async (req, res) => {
  const parsedParams = UpdateEngramConfigParams.safeParse({ id: req.params.id });
  const parsedBody = UpdateEngramConfigBody.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const engram = await loadEngram(parsedParams.data.id);
  if (!engram) {
    res.status(404).json({ error: "Engram not found" });
    return;
  }

  const body = parsedBody.data;
  const patch: Partial<typeof engramsTable.$inferInsert> = { updatedAt: new Date() };
  if (body.autonomyEnabled !== undefined) patch.autonomyEnabled = body.autonomyEnabled;
  if (body.tickCadenceSeconds !== undefined)
    patch.tickCadenceSeconds = Math.round(Math.max(15, Math.min(3600, body.tickCadenceSeconds)));
  if (body.initiationThreshold !== undefined)
    patch.initiationThreshold = Math.max(0.1, Math.min(0.95, body.initiationThreshold));
  if (body.mode !== undefined) patch.mode = body.mode;
  if (body.humanContactEnabled !== undefined) patch.humanContactEnabled = body.humanContactEnabled;
  if (body.simulationEnabled !== undefined) patch.simulationEnabled = body.simulationEnabled;
  if (body.focusThemes !== undefined) patch.focusThemes = body.focusThemes;
  if (body.emotionalBaseline !== undefined) {
    patch.emotionalBaseline = body.emotionalBaseline;
    patch.currentMood = body.emotionalBaseline.mood;
  }
  if (body.drives !== undefined) patch.drives = body.drives;

  const [updated] = await db
    .update(engramsTable)
    .set(patch)
    .where(eq(engramsTable.id, engram.id))
    .returning();
  res.json(updated);
});

router.post("/engrams/:id/activate", async (req, res) => {
  const parsed = ActivateEngramParams.safeParse({ id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const engram = await loadEngram(parsed.data.id);
  if (!engram) {
    res.status(404).json({ error: "Engram not found" });
    return;
  }
  await db.update(engramsTable).set({ isChatActive: false }).where(eq(engramsTable.isChatActive, true));
  const [updated] = await db
    .update(engramsTable)
    .set({ isChatActive: true, updatedAt: new Date() })
    .where(eq(engramsTable.id, engram.id))
    .returning();
  res.json(updated);
});

router.post("/engrams/:id/transmit", async (req, res) => {
  const parsed = TransmitEngramParams.safeParse({ id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const engram = await loadEngram(parsed.data.id);
  if (!engram) {
    res.status(404).json({ error: "Engram not found" });
    return;
  }
  try {
    const tx = await forceTransmission(engram);
    res.status(201).json(tx);
  } catch (err) {
    req.log.error(err);
    res.status(503).json({ error: "Generation unavailable" });
  }
});

router.get("/engrams/:id/transmissions", async (req, res) => {
  const parsed = ListEngramTransmissionsParams.safeParse({ id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(engramTransmissionsTable)
    .where(eq(engramTransmissionsTable.engramId, parsed.data.id))
    .orderBy(desc(engramTransmissionsTable.createdAt))
    .limit(TRANSMISSION_LIST_CAP);
  res.json(rows);
});

router.post("/engrams/:id/transmissions/mark-seen", async (req, res) => {
  const parsedParams = MarkTransmissionsSeenParams.safeParse({ id: req.params.id });
  const parsedBody = MarkTransmissionsSeenBody.safeParse(req.body ?? {});
  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { id } = parsedParams.data;
  const ids = parsedBody.data.ids;
  const filter =
    ids && ids.length > 0
      ? and(eq(engramTransmissionsTable.engramId, id), inArray(engramTransmissionsTable.id, ids))
      : and(eq(engramTransmissionsTable.engramId, id), eq(engramTransmissionsTable.seen, false));

  const marked = await db
    .update(engramTransmissionsTable)
    .set({ seen: true })
    .where(filter)
    .returning({ id: engramTransmissionsTable.id });
  res.json({ marked: marked.length });
});

router.get("/engrams/:id/inquiries", async (req, res) => {
  const parsed = ListEngramInquiriesParams.safeParse({ id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rows = await db
    .select()
    .from(engramInquiriesTable)
    .where(eq(engramInquiriesTable.engramId, parsed.data.id))
    .orderBy(desc(engramInquiriesTable.createdAt));
  res.json(rows);
});

router.post("/engrams/:id/inquiries", async (req, res) => {
  const parsedParams = CreateEngramInquiryParams.safeParse({ id: req.params.id });
  const parsedBody = CreateEngramInquiryBody.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const engram = await loadEngram(parsedParams.data.id);
  if (!engram) {
    res.status(404).json({ error: "Engram not found" });
    return;
  }
  const { kind, question } = parsedBody.data;

  try {
    if (kind === "probe") {
      const response = await generateProbeResponse({ engram, question });
      const [row] = await db
        .insert(engramInquiriesTable)
        .values({ engramId: engram.id, kind, question, response, configDelta: null })
        .returning();
      res.status(201).json(row);
      return;
    }

    // develop: tune the engram within bounded fields.
    const { response, delta } = await generateDevelopment({ engram, question });

    const patch: Partial<typeof engramsTable.$inferInsert> = { updatedAt: new Date() };
    if (delta.emotionalBaseline) {
      const merged: EmotionalBaseline = { ...engram.emotionalBaseline, ...delta.emotionalBaseline };
      patch.emotionalBaseline = merged;
      if (delta.emotionalBaseline.mood) patch.currentMood = delta.emotionalBaseline.mood;
    }
    if (delta.focusThemes) patch.focusThemes = delta.focusThemes;
    if (delta.driveWeights) {
      patch.drives = engram.drives.map((d) =>
        delta.driveWeights && d.id in delta.driveWeights
          ? { ...d, weight: delta.driveWeights[d.id] }
          : d,
      );
    }
    if (delta.addFacts && delta.addFacts.length > 0) {
      const facts = [...engram.memorySeed.facts];
      for (const f of delta.addFacts) {
        if (!facts.includes(f)) facts.push(f);
      }
      patch.memorySeed = { ...engram.memorySeed, facts: facts.slice(-MAX_FACTS) };
    }
    if (delta.initiationThreshold !== undefined) patch.initiationThreshold = delta.initiationThreshold;
    if (delta.tickCadenceSeconds !== undefined) patch.tickCadenceSeconds = delta.tickCadenceSeconds;

    if (Object.keys(patch).length > 1) {
      await db.update(engramsTable).set(patch).where(eq(engramsTable.id, engram.id));
    }

    const [row] = await db
      .insert(engramInquiriesTable)
      .values({
        engramId: engram.id,
        kind,
        question,
        response,
        configDelta: delta as Record<string, unknown>,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error(err);
    res.status(503).json({ error: "Generation unavailable" });
  }
});

export default router;
