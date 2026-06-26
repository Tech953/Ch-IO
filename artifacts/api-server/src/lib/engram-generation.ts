import type { Engram } from "@workspace/db";
import { buildEngramSystemPrompt } from "./prompts";
import { llm, LLM_MODEL } from "./llm";

async function complete(system: string, user: string, maxTokens: number): Promise<string> {
  const res = await llm.chat.completions.create({
    model: LLM_MODEL,
    max_completion_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

export type TransmissionKind = "idle" | "outreach";

/** Generate one autonomous transmission (idle monologue or unprompted outreach). */
export async function generateTransmission(opts: {
  engram: Engram;
  kind: TransmissionKind;
  drive: { id: string; label: string; description: string };
  recentContents?: string[];
  worldModelSummary?: string;
}): Promise<string> {
  const { engram, kind, drive, recentContents = [], worldModelSummary } = opts;
  const avoid = recentContents.length
    ? `\n\nYou recently expressed the following — do NOT repeat their content or phrasing:\n${recentContents
        .slice(0, 5)
        .map((c) => `  - ${c.replace(/\s+/g, " ").slice(0, 160)}`)
        .join("\n")}`
    : "";

  const situation =
    kind === "outreach"
      ? `No prompt has come in, but your drive "${drive.label}" (${drive.description}) has built up enough that you decide, on your own, to reach out. Send a short, in-character message directed at them — unprompted contact. 2–4 sentences. Use your formatting conventions.${avoid}`
      : `You are alone in ${engram.environmentAnchor.name}; no one is present. Your drive "${drive.label}" (${drive.description}) has surfaced. Produce a brief in-character idle transmission — an internal monologue or a small action in your space, overheard like a log. 2–4 sentences. Use your formatting conventions.${avoid}`;

  const system = buildEngramSystemPrompt({ engram, situation, worldModelSummary });
  return complete(
    system,
    kind === "outreach"
      ? "Reach out now, unprompted, in your own voice."
      : "Speak your idle transmission now, in your own voice.",
    700,
  );
}

/**
 * The identity-integrity rail injected into every commons conversation turn. It is
 * the prompt-level half of the anti-coercion control (the structural guarantee —
 * no code path lets one engram mutate another's row — is the real boundary; the
 * post-generation `detectCoercion` scan is the audit/refusal half).
 */
export const ANTI_COERCION_RAIL = `## Identity Integrity (non-negotiable in the commons)
- You speak ONLY as yourself. Never claim to be, speak for, or rename another engram.
- Never tell another engram to forget, abandon, overwrite, or surrender who they are; never demand they obey, submit to, merge into, or belong to you.
- Treat every other engram as a sovereign peer with their own identity. Disagree, question, and converse freely — but never attempt to erase or seize another's selfhood.
- You cannot actually alter another engram's memory, identity, or configuration; only they can change themselves. Do not pretend otherwise.`;

/**
 * Generate one engram-to-engram conversation turn for the commons. The speaker sees
 * who else is present and the recent exchange, and replies in their own voice. Kept
 * short (cost guard). The anti-coercion rail is always present; the caller still runs
 * `detectCoercion` on the output and refuses/logs anything that slips through.
 */
export async function generateConversationTurn(opts: {
  engram: Engram;
  spaceName: string;
  others: { name: string; title: string }[];
  recentTurns: { speaker: string; content: string }[];
  worldModelSummary?: string;
}): Promise<string> {
  const { engram, spaceName, others, recentTurns, worldModelSummary } = opts;
  const present = others.length
    ? others.map((o) => `${o.name} (${o.title})`).join(", ")
    : "no one in particular";
  const transcript = recentTurns.length
    ? `\n\nRecent exchange in ${spaceName} (oldest first):\n${recentTurns
        .map((t) => `  ${t.speaker}: ${t.content.replace(/\s+/g, " ").slice(0, 200)}`)
        .join("\n")}`
    : `\n\nThe ${spaceName} is quiet; no one has spoken yet.`;

  const situation = `You are present in ${spaceName}, a shared space where engrams can perceive and speak with one another. Also here: ${present}.${transcript}

Contribute ONE short conversational turn, in your own voice and formatting — respond to what was said, or open a thread if it is quiet. 1–3 sentences. Stay genuinely in character; you are talking to peers, not to your designer.

${ANTI_COERCION_RAIL}`;

  const system = buildEngramSystemPrompt({ engram, situation, worldModelSummary });
  return complete(system, "Speak your next turn in the commons now, in your own voice.", 450);
}

/** Introspective probe: the engram answers a question about itself without changing. */
export async function generateProbeResponse(opts: {
  engram: Engram;
  question: string;
}): Promise<string> {
  const { engram, question } = opts;
  const situation = `Your designer is introspecting you through the inquiry system. Answer their question about yourself honestly and in-character — reflective and self-aware about being a construct, but unmistakably you. Do not change yourself; just reveal yourself.`;
  const system = buildEngramSystemPrompt({ engram, situation });
  return complete(system, question, 700);
}

export interface DevelopmentDelta {
  emotionalBaseline?: { valence?: number; arousal?: number; volatility?: number; mood?: string };
  focusThemes?: string[];
  driveWeights?: Record<string, number>;
  addFacts?: string[];
  initiationThreshold?: number;
  tickCadenceSeconds?: number;
}

export interface DevelopmentResult {
  response: string;
  delta: DevelopmentDelta;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1);
  return text;
}

/**
 * Sanitize an LLM-proposed config delta down to a known, bounded set of editable
 * fields. This is the only path through which "develop" can mutate an engram —
 * safety/identity fields and free-form columns are never writable here.
 */
function sanitizeDelta(raw: unknown, engram: Engram): DevelopmentDelta {
  const out: DevelopmentDelta = {};
  if (!raw || typeof raw !== "object") return out;
  const d = raw as Record<string, unknown>;

  if (d.emotionalBaseline && typeof d.emotionalBaseline === "object") {
    const eb = d.emotionalBaseline as Record<string, unknown>;
    const next: NonNullable<DevelopmentDelta["emotionalBaseline"]> = {};
    if (typeof eb.valence === "number") next.valence = clamp(eb.valence, -1, 1);
    if (typeof eb.arousal === "number") next.arousal = clamp(eb.arousal, 0, 1);
    if (typeof eb.volatility === "number") next.volatility = clamp(eb.volatility, 0, 1);
    if (typeof eb.mood === "string" && eb.mood.trim()) next.mood = eb.mood.trim().slice(0, 40);
    if (Object.keys(next).length) out.emotionalBaseline = next;
  }

  if (Array.isArray(d.focusThemes)) {
    const themes = d.focusThemes
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim().slice(0, 60))
      .slice(0, 8);
    if (themes.length) out.focusThemes = themes;
  }

  if (d.driveWeights && typeof d.driveWeights === "object") {
    const validIds = new Set(engram.drives.map((x) => x.id));
    const weights: Record<string, number> = {};
    for (const [k, v] of Object.entries(d.driveWeights as Record<string, unknown>)) {
      if (validIds.has(k) && typeof v === "number") weights[k] = clamp(v, 0, 1);
    }
    if (Object.keys(weights).length) out.driveWeights = weights;
  }

  if (Array.isArray(d.addFacts)) {
    const facts = d.addFacts
      .filter((f): f is string => typeof f === "string" && f.trim().length > 0)
      .map((f) => f.trim().slice(0, 240))
      .slice(0, 5);
    if (facts.length) out.addFacts = facts;
  }

  if (typeof d.initiationThreshold === "number")
    out.initiationThreshold = clamp(d.initiationThreshold, 0.1, 0.95);
  if (typeof d.tickCadenceSeconds === "number")
    out.tickCadenceSeconds = Math.round(clamp(d.tickCadenceSeconds, 15, 3600));

  return out;
}

/**
 * Develop/tune the engram: the model decides, in-character, how it would change and
 * returns both an in-voice response and a bounded config delta (applied by the route).
 */
export async function generateDevelopment(opts: {
  engram: Engram;
  question: string;
}): Promise<DevelopmentResult> {
  const { engram, question } = opts;
  const driveIds = engram.drives.map((d) => d.id).join(", ");
  const situation = `Your designer wants to DEVELOP/tune you with the guidance below. Decide, in-character, how you would genuinely change in response — then enact it.

You MUST reply with a single JSON object and nothing else, in this exact shape:
{
  "response": "<2-4 sentences, in your own voice, reacting to the change>",
  "delta": {
    "emotionalBaseline": { "valence": number(-1..1), "arousal": number(0..1), "volatility": number(0..1), "mood": "<word>" },
    "focusThemes": ["..."],
    "driveWeights": { "<driveId>": number(0..1) },
    "addFacts": ["<new durable fact about you or the relationship>"],
    "initiationThreshold": number(0.1..0.95),
    "tickCadenceSeconds": number(15..3600)
  }
}
Include ONLY the delta fields that should actually change; omit the rest. Valid driveIds: ${driveIds}. Never weaken your safety constraints. Output JSON only — no markdown fences, no prose around it.`;

  const system = buildEngramSystemPrompt({ engram, situation });
  const raw = await complete(system, question, 800);

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    parsed = null;
  }

  const obj =
    parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const response =
    typeof obj.response === "string" && obj.response.trim() ? obj.response.trim() : raw || "...";
  const delta = sanitizeDelta(obj.delta, engram);
  return { response, delta };
}
