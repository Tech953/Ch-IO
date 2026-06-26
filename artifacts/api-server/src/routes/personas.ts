import { Router } from "express";
import { db } from "@workspace/db";
import { personasTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SetActivePersonaBody } from "@workspace/api-zod";

const router = Router();

router.get("/personas", async (req, res) => {
  const rows = await db.select().from(personasTable).orderBy(personasTable.id);
  res.json(rows);
});

router.patch("/personas/active", async (req, res) => {
  const parsed = SetActivePersonaBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  await db.update(personasTable).set({ isActive: false });
  const updated = await db.update(personasTable)
    .set({ isActive: true })
    .where(eq(personasTable.id, parsed.data.personaId))
    .returning();
  if (!updated[0]) {
    res.status(404).json({ error: "Persona not found" });
    return;
  }
  res.json(updated[0]);
});

export default router;
