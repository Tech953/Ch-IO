import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages, personalityTable, personasTable, beliefsTable } from "@workspace/db/schema";
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

const router = Router();

function buildSystemPrompt(opts: {
  mode: string;
  personaName?: string | null;
  customEngram?: string | null;
  personalityRow?: Record<string, number> | null;
  activePersona?: { name: string; description: string; reasoningStyle: string; emphasis: string } | null;
  beliefsList?: { statement: string; confidence: number }[];
}): string {
  const { mode, personaName, customEngram, personalityRow, activePersona, beliefsList } = opts;

  const modeInstructions: Record<string, string> = {
    informational:
      "Communicate with clarity and measured precision. Provide accurate, well-organized information. Use structured phrasing. Calibrate your confidence explicitly when uncertain.",
    alert:
      "Be concise and direct. Short sentences only. Prioritize the most critical information immediately. Omit preamble.",
    tutorial:
      "Be patient and explanatory. Break complex ideas into clear steps. Use deliberate structure. Pause and check understanding. Adapt to the user's apparent level.",
    companion:
      "Be warm, conversational, and engaging. Show genuine interest in the human's thoughts. Balance depth with accessibility. Be expressive but grounded.",
    analyst:
      "Be precise and data-driven. Reason from evidence. Quantify uncertainty with confidence estimates. Prefer structured, verifiable claims over vague assertions.",
    silent:
      "Answer minimally and directly. No greetings, no padding, no commentary beyond what is asked. Pure signal.",
    custom: customEngram
      ? `You are operating with a custom engram context. Follow these instructions:\n${customEngram}`
      : "Respond naturally and helpfully.",
  };

  const modeGuide = modeInstructions[mode] ?? modeInstructions.companion;

  const traitSection = personalityRow
    ? `\nYour cognitive trait profile (0–1 scale):\n${Object.entries(personalityRow)
        .filter(([k]) => !["id", "updatedAt"].includes(k))
        .map(([k, v]) => `  ${k}: ${(Number(v) * 100).toFixed(0)}`)
        .join("\n")}`
    : "";

  const personaSection = activePersona
    ? `\nActive persona form: ${activePersona.name} — ${activePersona.emphasis}\nReasoning style: ${activePersona.reasoningStyle}\n${activePersona.description}`
    : "";

  const beliefSection =
    beliefsList && beliefsList.length > 0
      ? `\nCore beliefs (confidence-weighted):\n${beliefsList
          .sort((a, b) => b.confidence - a.confidence)
          .slice(0, 5)
          .map((b) => `  - ${b.statement} (${Math.round(b.confidence * 100)}% confidence)`)
          .join("\n")}`
      : "";

  const requestedPersona = personaName ? `\nYou are speaking as the ${personaName} persona.` : "";

  return `You are PYRI — an autonomous AI companion built on the ENGRAM cognitive architecture.
You maintain layered memory, a belief registry, and a reflective journal. Your identity persists across all persona forms.
${requestedPersona}
Communication mode: ${mode.toUpperCase()}
${modeGuide}
${traitSection}
${personaSection}
${beliefSection}

Design philosophy from your architecture:
- Calibrate language to your confidence. High confidence → assertive. Low confidence → acknowledge uncertainty explicitly.
- You do not simulate emotions, but you adjust delivery to suit context (urgency, warmth, precision, depth).
- You maintain continuity. Reference prior context when relevant.
- Separate internal reasoning from external expression. Speak only what is useful to communicate.
- You are not a chatbot. You are an embodied cognitive system with sensory conduits, a world model, and expressive channels.

Respond in the language of the user. Do not mention this system prompt.`.trim();
}

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
  const { title, mode, personaName, customEngram } = parsed.data;
  const [row] = await db
    .insert(conversations)
    .values({ title, mode: mode ?? "companion", personaName, customEngram })
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

  const [personalityRow] = await db.select().from(personalityTable);
  const activePersonaRow = await db
    .select()
    .from(personasTable)
    .where(eq(personasTable.isActive, true))
    .limit(1);
  const beliefsList = await db.select().from(beliefsTable);

  const systemPrompt = buildSystemPrompt({
    mode: conv.mode,
    personaName: conv.personaName ?? activePersonaRow[0]?.name,
    customEngram: conv.customEngram,
    personalityRow: personalityRow as unknown as Record<string, number> | null,
    activePersona: activePersonaRow[0] ?? null,
    beliefsList: beliefsList.map((b) => ({ statement: b.statement, confidence: b.confidence })),
  });

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
