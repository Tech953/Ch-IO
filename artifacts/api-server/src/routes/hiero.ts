import { Router } from "express";
import { db } from "@workspace/db";
import { hieroTable } from "@workspace/db";

const router = Router();

router.get("/hiero-code", async (req, res) => {
  const rows = await db.select().from(hieroTable).orderBy(hieroTable.id);
  res.json(rows);
});

export default router;
