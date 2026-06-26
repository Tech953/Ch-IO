import { Router } from "express";
import { db } from "@workspace/db";
import {
  memoriesTable, beliefsTable, journalTable,
  initiativeTable, evolutionTable, personasTable
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/stats", async (req, res) => {
  const [
    memoriesCount,
    beliefsCount,
    journalCount,
    initiativeCount,
    evolutionCount,
    activePersonaRows,
    avgConfidenceRows,
    memoryByLayerRows,
    beliefConfRows,
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(memoriesTable),
    db.select({ count: sql<number>`count(*)::int` }).from(beliefsTable),
    db.select({ count: sql<number>`count(*)::int` }).from(journalTable),
    db.select({ count: sql<number>`count(*)::int` }).from(initiativeTable),
    db.select({ count: sql<number>`count(*)::int` }).from(evolutionTable),
    db.select({ name: personasTable.name }).from(personasTable).where(eq(personasTable.isActive, true)).limit(1),
    db.select({ avg: sql<number>`coalesce(avg(confidence), 0)::float` }).from(beliefsTable),
    db.select({
      layer: memoriesTable.layer,
      count: sql<number>`count(*)::int`,
    }).from(memoriesTable).groupBy(memoriesTable.layer),
    db.select({
      confidence: beliefsTable.confidence,
    }).from(beliefsTable),
  ]);

  const now = new Date();
  const initiativeByDay = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    initiativeByDay.push({ date: d.toISOString().split("T")[0], count: 0 });
  }
  const initiativeRows = await db.select({
    date: sql<string>`date_trunc('day', created_at)::date::text`,
    count: sql<number>`count(*)::int`,
  }).from(initiativeTable)
    .where(sql`created_at >= now() - interval '7 days'`)
    .groupBy(sql`date_trunc('day', created_at)`);

  for (const row of initiativeRows) {
    const idx = initiativeByDay.findIndex(d => d.date === row.date);
    if (idx !== -1) initiativeByDay[idx].count = row.count;
  }

  const buckets = [
    { range: "0–25%", min: 0, max: 0.25 },
    { range: "26–50%", min: 0.25, max: 0.5 },
    { range: "51–75%", min: 0.5, max: 0.75 },
    { range: "76–100%", min: 0.75, max: 1.01 },
  ];
  const beliefConfidenceDistribution = buckets.map(b => ({
    range: b.range,
    count: beliefConfRows.filter(r => r.confidence >= b.min && r.confidence < b.max).length,
  }));

  res.json({
    totalMemories: memoriesCount[0]?.count ?? 0,
    totalBeliefs: beliefsCount[0]?.count ?? 0,
    totalJournalEntries: journalCount[0]?.count ?? 0,
    totalInitiativeEvents: initiativeCount[0]?.count ?? 0,
    evolutionRevisions: evolutionCount[0]?.count ?? 0,
    activePersona: activePersonaRows[0]?.name ?? "None",
    avgBeliefConfidence: avgConfidenceRows[0]?.avg ?? 0,
    memoryByLayer: memoryByLayerRows,
    initiativeByDay,
    beliefConfidenceDistribution,
  });
});

export default router;
