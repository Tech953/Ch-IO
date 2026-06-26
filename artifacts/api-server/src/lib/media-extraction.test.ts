import { describe, it, expect } from "vitest";
import { detectModality, MEDIA_MIME_ALLOWLIST } from "./media-extraction";

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
