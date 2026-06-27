import OpenAI from "openai";

/**
 * Provider seam for OUTBOUND media generation (image + video) — the costed,
 * online mirror of the `llm` seam used for chat/perception. Kept separate from
 * `llm.ts` so a deployment can point generation at a different endpoint than its
 * chat model (e.g. chat on a local runtime, images on a cloud provider).
 *
 * Resolution order (first defined wins), so generation "just works" wherever the
 * chat model already does, while still being independently overridable:
 *   - GENERATION_BASE_URL / GENERATION_API_KEY      (explicit generation provider)
 *   - LLM_BASE_URL / LLM_API_KEY                     (shared with the chat seam)
 *   - AI_INTEGRATIONS_OPENAI_BASE_URL / ..._API_KEY  (Replit cloud default)
 *
 * When NO base URL resolves (fully offline desktop / no cloud integration), the
 * seam is "unavailable": every generator throws and the caller fails the job
 * closed with a clear message. PDF generation never touches this seam, so it
 * keeps working offline regardless.
 */

const IMAGE_MODEL = process.env.GENERATION_IMAGE_MODEL ?? "gpt-image-1";
const IMAGE_SIZE = process.env.GENERATION_IMAGE_SIZE ?? "1024x1024";
const VIDEO_MODEL = process.env.GENERATION_VIDEO_MODEL ?? "sora-2";
const VIDEO_SIZE = process.env.GENERATION_VIDEO_SIZE ?? "1280x720";
const VIDEO_SECONDS = process.env.GENERATION_VIDEO_SECONDS ?? "4";
const VIDEO_POLL_MS = Number(process.env.GENERATION_VIDEO_POLL_MS) || 5_000;
const VIDEO_TIMEOUT_MS =
  Number(process.env.GENERATION_VIDEO_TIMEOUT_MS) || 5 * 60_000;

interface GenerationConfig {
  baseURL: string;
  apiKey: string;
}

/** Resolve the generation endpoint from env, or null when nothing is configured. */
function resolveConfig(): GenerationConfig | null {
  const baseURL =
    process.env.GENERATION_BASE_URL ??
    process.env.LLM_BASE_URL ??
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!baseURL) return null;
  const apiKey =
    process.env.GENERATION_API_KEY ??
    process.env.LLM_API_KEY ??
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ??
    "local";
  return { baseURL, apiKey };
}

// Cache the client but key it on the resolved config so env changes (notably in
// tests / desktop settings flips) rebuild it instead of going stale.
let cached: { key: string; client: OpenAI } | null = null;
function getClient(): OpenAI | null {
  const cfg = resolveConfig();
  if (!cfg) return null;
  const key = `${cfg.baseURL}\u0000${cfg.apiKey}`;
  if (cached?.key !== key) {
    cached = { key, client: new OpenAI(cfg) };
  }
  return cached.client;
}

/** True when an online generation provider is configured (image/video can run). */
export function generationConfigured(): boolean {
  return resolveConfig() !== null;
}

const OFFLINE_MESSAGE =
  "No online generation provider is configured. Set GENERATION_BASE_URL " +
  "(or reuse LLM_BASE_URL / the Replit OpenAI integration) to enable image and " +
  "video generation. PDF generation works offline regardless.";

export interface GeneratedBinary {
  data: Buffer;
  mimeType: string;
  provider: string;
}

/**
 * Generate a single PNG image from a text prompt via the OpenAI-compatible
 * `images.generate` API. Handles both `b64_json` (gpt-image-1) and `url`
 * (dall-e family) responses so it works across providers.
 */
export async function generateImage(prompt: string): Promise<GeneratedBinary> {
  const client = getClient();
  if (!client) throw new GenerationUnavailableError(OFFLINE_MESSAGE);

  const res = await client.images.generate({
    model: IMAGE_MODEL,
    prompt,
    size: IMAGE_SIZE,
  } as OpenAI.ImageGenerateParamsNonStreaming);

  const first = res.data?.[0];
  if (first?.b64_json) {
    return {
      data: Buffer.from(first.b64_json, "base64"),
      mimeType: "image/png",
      provider: `${IMAGE_MODEL}`,
    };
  }
  if (first?.url) {
    const fetched = await fetch(first.url);
    if (!fetched.ok) {
      throw new Error(`Image provider returned an unreadable URL (${fetched.status}).`);
    }
    return {
      data: Buffer.from(await fetched.arrayBuffer()),
      mimeType: fetched.headers.get("content-type") ?? "image/png",
      provider: `${IMAGE_MODEL}`,
    };
  }
  throw new Error("Image provider returned no image data.");
}

/**
 * Generate a video from a text prompt via the OpenAI-compatible async `videos`
 * API (create → poll → download). Long-running by nature; bounded by
 * GENERATION_VIDEO_TIMEOUT_MS so a stuck job fails closed instead of blocking
 * the worker forever.
 */
export async function generateVideo(prompt: string): Promise<GeneratedBinary> {
  const client = getClient();
  if (!client) throw new GenerationUnavailableError(OFFLINE_MESSAGE);

  let job = await client.videos.create({
    model: VIDEO_MODEL,
    prompt,
    size: VIDEO_SIZE,
    seconds: VIDEO_SECONDS,
  } as OpenAI.VideoCreateParams);

  const deadline = Date.now() + VIDEO_TIMEOUT_MS;
  while (job.status === "queued" || job.status === "in_progress") {
    if (Date.now() > deadline) {
      throw new Error(
        `Video generation timed out after ${Math.round(VIDEO_TIMEOUT_MS / 1000)}s ` +
          `(last status: ${job.status}, ${job.progress}%).`,
      );
    }
    await sleep(VIDEO_POLL_MS);
    job = await client.videos.retrieve(job.id);
  }

  if (job.status !== "completed") {
    throw new Error(
      `Video generation failed: ${job.error?.message ?? "unknown provider error"}.`,
    );
  }

  const content = await client.videos.downloadContent(job.id);
  if (!content.ok) {
    throw new Error(`Video download failed (${content.status}).`);
  }
  return {
    data: Buffer.from(await content.arrayBuffer()),
    mimeType: content.headers.get("content-type") ?? "video/mp4",
    provider: `${VIDEO_MODEL}`,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    if (typeof t.unref === "function") t.unref();
  });
}

/**
 * Thrown when generation is requested but no online provider is configured.
 * Re-exported through artifact-generation as a ProviderUnavailableError so the
 * worker's existing fail-closed path handles it uniformly.
 */
export class GenerationUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationUnavailableError";
  }
}
