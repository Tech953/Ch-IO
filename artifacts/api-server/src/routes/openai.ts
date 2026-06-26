import { Router } from "express";
import { db } from "@workspace/db";
import {
  conversations,
  messages,
  personalityTable,
  personasTable,
  beliefsTable,
  expressionsTable,
  engramsTable,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  CreateOpenaiConversationBody,
  SendOpenaiMessageBody,
  GetOpenaiConversationParams,
  DeleteOpenaiConversationParams,
  ListOpenaiMessagesParams,
  SendOpenaiMessageParams,
} from "@workspace/api-zod";
import { buildSystemPrompt, buildEngramSystemPrompt, type ExpressionRow } from "../lib/prompts";

const router = Router();

router.get("/openai/conversations", async (req, res) => {
  const rows = await db
    .select()
    .from(conversations)
    .orderBy(desc(conversations.createdAt));
  res.json(rows);
});

router.post("/openai/conversations", async (req, res) => {
  const parsed = CreateOpenaiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { title, mode, personaName, customEngram, engramId } = parsed.data;
  const [row] = await db
    .insert(conversations)
    .values({ title, mode: mode ?? "companion", personaName, customEngram, engramId })
    .returning();
  res.status(201).json(row);
});

router.get("/openai/conversations/:id", async (req, res) => {
  const parsed = GetOpenaiConversationParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { id } = parsed.data;
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.createdAt);
  res.json({ ...conv, messages: msgs });
});

router.delete("/openai/conversations/:id", async (req, res) => {
  const parsed = DeleteOpenaiConversationParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { id } = parsed.data;
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  await db.delete(conversations).where(eq(conversations.id, id));
  res.status(204).send();
});

router.get("/openai/conversations/:id/messages", async (req, res) => {
  const parsed = ListOpenaiMessagesParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, parsed.data.id))
    .orderBy(messages.createdAt);
  res.json(msgs);
});

router.post("/openai/conversations/:id/messages", async (req, res) => {
  const parsedParams = SendOpenaiMessageParams.safeParse({ id: Number(req.params.id) });
  const parsedBody = SendOpenaiMessageBody.safeParse(req.body);
  if (!parsedParams.success || !parsedBody.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { id } = parsedParams.data;
  const { content } = parsedBody.data;

  const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  // An engram-linked conversation embodies that engram's persona; otherwise PYRI answers.
  let systemPrompt: string;
  if (conv.engramId) {
    const [engram] = await db.select().from(engramsTable).where(eq(engramsTable.id, conv.engramId));
    if (!engram) {
      res.status(404).json({ error: "Engram not found" });
      return;
    }
    systemPrompt = buildEngramSystemPrompt({
      engram,
      situation:
        "You are in a live, ongoing conversation with them right now. Respond to their latest message in character, staying in your formatting conventions.",
    });
  } else {
    const [personalityRow] = await db.select().from(personalityTable);
    const activePersonaRow = await db
      .select()
      .from(personasTable)
      .where(eq(personasTable.isActive, true))
      .limit(1);
    const beliefsList = await db.select().from(beliefsTable);
    const expressionsList =
      conv.mode === "silent"
        ? []
        : await db.select().from(expressionsTable).orderBy(expressionsTable.id);

    systemPrompt = buildSystemPrompt({
      mode: conv.mode,
      personaName: conv.personaName ?? activePersonaRow[0]?.name,
      customEngram: conv.customEngram,
      personalityRow: personalityRow as unknown as Record<string, number> | null,
      activePersona: activePersonaRow[0] ?? null,
      beliefsList: beliefsList.map((b) => ({ statement: b.statement, confidence: b.confidence })),
      expressions: expressionsList.map(
        (e): ExpressionRow => ({
          glyph: e.glyph,
          name: e.name,
          family: e.family,
          valence: e.valence,
          arousal: e.arousal,
          intimacy: e.intimacy,
          cognitiveRole: e.cognitiveRole,
        }),
      ),
    });
  }

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.createdAt);

  await db.insert(messages).values({ conversationId: id, role: "user", content });

  const chatMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content },
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  let fullResponse = "";
  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullResponse += delta;
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
    }

    await db.insert(messages).values({ conversationId: id, role: "assistant", content: fullResponse });
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    req.log.error(err);
    res.write(`data: ${JSON.stringify({ error: "Generation failed" })}\n\n`);
  }
  res.end();
});

export default router;
