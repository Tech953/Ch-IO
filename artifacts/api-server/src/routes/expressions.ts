import { Router } from "express";
import { db } from "@workspace/db";
import { expressionsTable } from "@workspace/db";

const router = Router();

router.get("/expressions", async (req, res) => {
  const rows = await db.select().from(expressionsTable).orderBy(expressionsTable.id);
  res.json(rows);
});

export default router;
