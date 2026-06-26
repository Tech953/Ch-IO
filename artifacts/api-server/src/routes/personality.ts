import { Router } from "express";
import { db } from "@workspace/db";
import { personalityTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdatePersonalityBody } from "@workspace/api-zod";

const router = Router();

router.get("/personality", async (req, res) => {
  const rows = await db.select().from(personalityTable).limit(1);
  if (rows.length === 0) {
    const inserted = await db.insert(personalityTable).values({}).returning();
    res.json(inserted[0]);
    return;
  }
  res.json(rows[0]);
});

router.patch("/personality", async (req, res) => {
  const parsed = UpdatePersonalityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const existing = await db.select().from(personalityTable).limit(1);
  if (existing.length === 0) {
    const inserted = await db.insert(personalityTable).values(parsed.data).returning();
    res.json(inserted[0]);
    return;
  }
  const updated = await db.update(personalityTable)
    .set(parsed.data)
    .where(eq(personalityTable.id, existing[0].id))
    .returning();
  res.json(updated[0]);
});

export default router;
