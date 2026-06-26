import { Router } from "express";
import { db } from "@workspace/db";
import { evolutionTable } from "@workspace/db";

const router = Router();

router.get("/evolution", async (req, res) => {
  const rows = await db.select().from(evolutionTable).orderBy(evolutionTable.revision);
  res.json(rows.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

export default router;
