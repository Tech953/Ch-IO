import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// --- Hoisted mocks for the LLM seam, openai helper, ffmpeg, and fs ------------
// extractFromMedia reaches the model ONLY through the `llm` provider seam and
// ffmpeg/ffprobe ONLY through node:child_process. Mocking those lets us assert
// the per-modality dispatch (and the env-driven binary resolution for video)
// with no cloud call and no real ffmpeg install.
const h = vi.hoisted(() => {
  const state = {
    // Each execFile(...) invocation, captured as { bin, args }.
    execCalls: [] as Array<{ bin: string; args: string[] }>,
    // What transcribeAudio gets back; "" models silence / no speech.
    transcript: "spoken words from the clip",
    // Bytes readFile returns for sampled frames + extracted audio (non-empty).
    readFileBuf: Buffer.from("binary-frame-or-audio-bytes"),
  };

  const chatCreate = vi.fn(async (_req: Record<string, unknown>) => ({
    choices: [
      {
        message: {
          content: JSON.stringify({
            observations: [
              "a lighthouse blinks twice",
              "a gull settles on the rail",
            ],
            summary: "A short harbor scene.",
          }),
        },
      },
    ],
  }));

  const transcribeCreate = vi.fn(async () => ({ text: state.transcript }));

  const llm = {
    chat: { completions: { create: chatCreate } },
    audio: { transcriptions: { create: transcribeCreate } },
  };

  return { state, chatCreate, transcribeCreate, llm };
});

vi.mock("./llm", () => ({ llm: h.llm, LLM_MODEL: "test-chat-model" }));
vi.mock("openai", () => ({
  toFile: vi.fn(async (buf: Buffer, name: string, opts: unknown) => ({
    buf,
    name,
    opts,
  })),
}));
vi.mock("node:child_process", () => ({
  // promisify(execFile) appends a (err, result) callback as the last argument.
  // Generic promisify resolves with the single value we pass after `null`, so we
  // hand back { stdout, stderr } the way the real customPromisified execFile does.
  execFile: (...args: unknown[]) => {
    const cb = args[args.length - 1] as (
      err: unknown,
      res: { stdout: string; stderr: string },
    ) => void;
    const bin = args[0] as string;
    const cmdArgs = (args[1] as string[]) ?? [];
    h.state.execCalls.push({ bin, args: cmdArgs });
    // ffprobe reports a duration; ffmpeg (frames/audio) writes files we mock via fs.
    const isProbe = cmdArgs.includes("-show_entries");
    cb(null, { stdout: isProbe ? "5.0\n" : "", stderr: "" });
  },
}));
vi.mock("node:fs/promises", () => ({
  mkdtemp: vi.fn(async (prefix: string) => `${prefix}test`),
  writeFile: vi.fn(async () => undefined),
  readFile: vi.fn(async () => h.state.readFileBuf),
  rm: vi.fn(async () => undefined),
}));

import {
  detectModality,
  MEDIA_MIME_ALLOWLIST,
  extractFromMedia,
} from "./media-extraction";

beforeEach(() => {
  vi.clearAllMocks();
  h.state.execCalls = [];
  h.state.transcript = "spoken words from the clip";
  h.state.readFileBuf = Buffer.from("binary-frame-or-audio-bytes");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// --- MIME allowlist drives modality -------------------------------------------
describe("detectModality — MIME allowlist drives modality (never client input)", () => {
  it("maps allowlisted MIME types to their modality", () => {
    expect(detectModality("text/plain")).toBe("text");
    expect(detectModality("application/json")).toBe("text");
    expect(detectModality("image/png")).toBe("image");
    expect(detectModality("image/jpeg")).toBe("image");
    expect(detectModality("audio/mpeg")).toBe("audio");
    expect(detectModality("video/mp4")).toBe("video");
  });

  it("normalizes case and strips charset/codec parameters", () => {
    expect(detectModality("TEXT/Plain")).toBe("text");
    expect(detectModality("text/plain; charset=utf-8")).toBe("text");
    expect(detectModality("  image/png ")).toBe("image");
    expect(detectModality('video/webm;codecs="vp9"')).toBe("video");
  });

  it("returns null for anything not on the allowlist", () => {
    expect(detectModality("application/zip")).toBeNull();
    expect(detectModality("application/x-msdownload")).toBeNull();
    expect(detectModality("")).toBeNull();
    expect(detectModality("text/")).toBeNull();
  });

  it("every allowlist value is a known modality", () => {
    const allowed = new Set(["text", "image", "audio", "video"]);
    for (const modality of Object.values(MEDIA_MIME_ALLOWLIST)) {
      expect(allowed.has(modality)).toBe(true);
    }
  });
});

// --- extractFromMedia: per-modality dispatch ----------------------------------
describe("extractFromMedia — text", () => {
  it("perceives a text document via the chat model, no transcript", async () => {
    const result = await extractFromMedia(
      { modality: "text", mimeType: "text/plain", filename: "harbor.txt" },
      Buffer.from("The harbor was quiet at dawn."),
    );

    expect(result.observations.length).toBeGreaterThan(0);
    expect(result.summary).toBe("A short harbor scene.");
    expect(result.transcript).toBeNull();
    // One chat call, the main chat model, no transcription.
    expect(h.chatCreate).toHaveBeenCalledTimes(1);
    expect(h.chatCreate.mock.calls[0][0]).toMatchObject({ model: "test-chat-model" });
    expect(h.transcribeCreate).not.toHaveBeenCalled();
  });
});

describe("extractFromMedia — image", () => {
  it("perceives an image via the vision model using a base64 data URL", async () => {
    const result = await extractFromMedia(
      { modality: "image", mimeType: "image/png", filename: "scene.png" },
      Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    );

    expect(result.observations.length).toBeGreaterThan(0);
    expect(result.transcript).toBeNull();
    expect(h.chatCreate).toHaveBeenCalledTimes(1);

    // The image is handed to the model as a data URL, never a raw path/field.
    const req = h.chatCreate.mock.calls[0][0] as {
      messages: Array<{ role: string; content: unknown }>;
    };
    const userMsg = req.messages.find((m) => m.role === "user")!;
    const parts = userMsg.content as Array<{ type: string; image_url?: { url: string } }>;
    const imagePart = parts.find((p) => p.type === "image_url");
    expect(imagePart?.image_url?.url).toMatch(/^data:image\/png;base64,/);
    expect(h.transcribeCreate).not.toHaveBeenCalled();
  });
});

describe("extractFromMedia — audio", () => {
  it("transcribes then extracts observations from the transcript", async () => {
    h.state.transcript = "the captain logged a heading of due north";

    const result = await extractFromMedia(
      { modality: "audio", mimeType: "audio/mpeg", filename: "log.mp3" },
      Buffer.from("audio-bytes"),
    );

    expect(h.transcribeCreate).toHaveBeenCalledTimes(1);
    expect(result.transcript).toBe("the captain logged a heading of due north");
    expect(result.observations.length).toBeGreaterThan(0);
    // Exactly one chat call: extraction over the transcript text.
    expect(h.chatCreate).toHaveBeenCalledTimes(1);
  });

  it("returns no observations when the audio has no discernible speech", async () => {
    h.state.transcript = "";

    const result = await extractFromMedia(
      { modality: "audio", mimeType: "audio/mpeg", filename: "silent.mp3" },
      Buffer.from("audio-bytes"),
    );

    expect(result.observations).toEqual([]);
    expect(result.transcript).toBe("");
    expect(result.summary).toMatch(/no discernible speech/i);
    // No transcript means nothing to extract — the chat model is never called.
    expect(h.chatCreate).not.toHaveBeenCalled();
  });
});

describe("extractFromMedia — unsupported modality", () => {
  it("throws for a modality outside the known set", async () => {
    await expect(
      extractFromMedia(
        { modality: "hologram", mimeType: "x/y", filename: "z" },
        Buffer.from(""),
      ),
    ).rejects.toThrow(/Unsupported media modality/i);
  });
});

// --- extractFromMedia: video (ffmpeg/ffprobe mocked, binaries from env) --------
describe("extractFromMedia — video", () => {
  it("samples frames + extracts audio, resolving binaries from FFMPEG_PATH/FFPROBE_PATH", async () => {
    // FFMPEG_BIN/FFPROBE_BIN are module-level consts read from env at import time,
    // so set the env and re-import the module to exercise the env-driven paths.
    vi.resetModules();
    vi.stubEnv("FFMPEG_PATH", "/opt/bin/ffmpeg");
    vi.stubEnv("FFPROBE_PATH", "/opt/bin/ffprobe");
    h.state.transcript = "audio narration from the video";

    const { extractFromMedia: extract } = await import("./media-extraction");
    const result = await extract(
      { modality: "video", mimeType: "video/mp4", filename: "clip.mp4" },
      Buffer.from("video-bytes"),
    );

    // ffprobe (duration) + ffmpeg (frame/audio) ran with the env-provided binaries.
    const bins = new Set(h.state.execCalls.map((c) => c.bin));
    expect(bins.has("/opt/bin/ffprobe")).toBe(true);
    expect(bins.has("/opt/bin/ffmpeg")).toBe(true);

    // Both perception channels contributed: vision frames + an audio transcript.
    expect(result.observations.length).toBeGreaterThan(0);
    expect(result.transcript).toBe("audio narration from the video");
    expect(h.transcribeCreate).toHaveBeenCalledTimes(1);
    // Two chat calls: one over the sampled frames, one over the audio transcript.
    expect(h.chatCreate).toHaveBeenCalledTimes(2);
  });
});
